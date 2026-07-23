/**
 * routes/chat.ts
 * OWNS: Chat processing — the main pipeline endpoint
 */
import { Router, Request, Response } from 'express';
import { IntentPipeline } from '../core/intent';
import { AgentRegistry, GeneralWorker, WebWorker, VisionWorker } from '../agents';
import { Settings } from '../config/settings';
import { AuthRequest, optionalAuth } from '../middleware/auth';
import { intentToDict } from '../core/intent/schemas';

const router = Router();

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
router.post('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { message, attachments = {}, customApiKey, customModel } = req.body;

    if (!message?.trim() && Object.keys(attachments).length === 0) {
      res.status(400).json({ error: 'Message or attachment required' });
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
    const result = await pipe.process(message || '[Image attached] Analyze this image', attachments);

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

// GET /api/chat/health
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    engine: 'SAGE v' + Settings.APP_VERSION,
    model: Settings.DEFAULT_MODEL,
    api_key: Settings.getMaskedKey(),
    uptime: process.uptime(),
  });
});

export default router;
