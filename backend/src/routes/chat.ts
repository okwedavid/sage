/**
 * routes/chat.ts
 * OWNS: Chat processing — the main pipeline endpoint
 */
import { Router, Request, Response } from 'express';
import { IntentPipeline } from '../core/intent';
import { AgentRegistry, GeneralWorker, WebWorker, VisionWorker } from '../agents';
import { Settings } from '../config/settings';
import { AuthRequest } from '../middleware/auth';
import { jwtOrApiKey, ApiKeyRequest } from '../middleware/api-key';
import { intentToDict } from '../core/intent/schemas';
import { isSupabaseConfigured, pingSupabase, recordUsage } from '../services/supabase';
import { metrics } from '../services/metrics';

const router = Router();

// ── Attachment validation ──
// image_base64 must be a base64 string within the configured size limit;
// metadata fields must be strings.
function validateAttachments(attachments: Record<string, any>): string | null {
  if (attachments === null || typeof attachments !== 'object' || Array.isArray(attachments)) {
    return 'Attachments must be an object';
  }

  for (const [key, value] of Object.entries(attachments)) {
    if (key === 'image_base64') {
      if (typeof value !== 'string' || value.length === 0) {
        return 'image_base64 must be a non-empty string';
      }
      if (!/^[A-Za-z0-9+/=\s]*$/.test(value)) {
        return 'image_base64 contains invalid characters';
      }
      const approxBytes = (value.length * 3) / 4;
      if (approxBytes > Settings.MAX_ATTACHMENT_BYTES) {
        return `Attachment too large (max ${Math.round(Settings.MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB)`;
      }
    } else if (value !== undefined && typeof value !== 'string') {
      return `Attachment '${key}' must be a string`;
    }
  }

  return null;
}

// Pipeline cache (keyed by config)
const pipelineCache = new Map<string, IntentPipeline>();

function getPipeline(apiKey: string, customModel?: string): IntentPipeline {
  const cacheKey = `${apiKey}:${customModel || 'default'}`;
  
  if (pipelineCache.has(cacheKey)) {
    return pipelineCache.get(cacheKey)!;
  }

  if (!apiKey || !apiKey.startsWith('gsk_')) {
    throw new Error('Invalid Groq API key');
  }

  const registry = new AgentRegistry();
  registry.registerWorker('GeneralWorker', new GeneralWorker(apiKey, customModel));
  registry.registerWorker('WebWorker', new WebWorker(apiKey, customModel));
  registry.registerWorker('VisionWorker', new VisionWorker(apiKey));

  const pipe = new IntentPipeline(apiKey, registry, customModel);
  pipelineCache.set(cacheKey, pipe);
  
  // Limit cache size
  if (pipelineCache.size > 100) {
    const firstKey = pipelineCache.keys().next().value;
    if (firstKey) pipelineCache.delete(firstKey);
  }
  
  return pipe;
}

// POST /api/chat — process a message through the pipeline
router.post('/', jwtOrApiKey, async (req: AuthRequest & ApiKeyRequest, res: Response) => {
  try {
    const { message, attachments = {}, customApiKey, customModel } = req.body;

    if (message !== undefined && typeof message !== 'string') {
      res.status(400).json({ error: 'Message must be a string' });
      return;
    }

    if (!message?.trim() && Object.keys(attachments).length === 0) {
      res.status(400).json({ error: 'Message or attachment required' });
      return;
    }

    if (typeof message === 'string' && message.length > Settings.MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: `Message too long (max ${Settings.MAX_MESSAGE_LENGTH} chars)` });
      return;
    }

    // Validate attachments before they reach the pipeline
    const invalidAttachment = validateAttachments(attachments);
    if (invalidAttachment) {
      res.status(400).json({ error: invalidAttachment });
      return;
    }

    // Use custom API key if provided, otherwise use server default
    const apiKey = (customApiKey && customApiKey.startsWith('gsk_')) 
      ? customApiKey 
      : Settings.GROQ_API_KEY;

    if (!apiKey || !apiKey.startsWith('gsk_')) {
      res.status(500).json({ error: 'No valid API key available. Please add your Groq API key in Settings.' });
      return;
    }

    // Create pipeline with custom config if needed
    const pipe = getPipeline(apiKey, customModel);
    const started = Date.now();
    const result = await pipe.process(message || '[Image attached] Analyze this image', attachments);

    // Async usage tracking (never blocks the response)
    recordUsage({
      userId: req.userId || null,
      endpoint: '/api/chat',
      model: customModel || Settings.DEFAULT_MODEL,
      statusCode: result.success ? 200 : 200,
      latencyMs: Date.now() - started,
    }).catch(() => {});

    res.json({
      success: result.success,
      response: result.response,
      agent: result.agent,
      intent: result.intent ? intentToDict(result.intent) : null,
      stages: result.stages,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/chat/health — extended with dependency + metric probes
router.get('/health', async (_req: Request, res: Response) => {
  const supabaseReady = isSupabaseConfigured();
  const supabaseOk = supabaseReady ? await pingSupabase() : false;

  res.json({
    status: 'ok',
    engine: 'SAGE v' + Settings.APP_VERSION,
    model: Settings.DEFAULT_MODEL,
    api_key: Settings.getMaskedKey(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    deps: {
      groq: Settings.validate() ? 'ok' : 'missing',
      supabase: supabaseReady ? (supabaseOk ? 'ok' : 'unreachable') : 'unconfigured',
    },
    metrics: metrics.snapshot(),
  });
});

export default router;
