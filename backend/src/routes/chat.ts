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
import { ConversationMemory } from '../services/context';
import { enforceChatQuota, recordChatUsage } from '../services/billing';
import { ChatGateway, providerService } from '../providers';
import { sniffMimeType } from '../providers/adapters/base';
import { addMessages as persistConversationTurn } from '../services/conversation-store';

const router = Router();

// ── Attachment validation ──
// image_base64 must be base64 within the size limit AND decode to a supported
// image signature (jpeg/png/webp/gif) matching the claimed image_type. This
// prevents garbage payloads from reaching providers and makes routing
// deterministic (Phase 4).
const ALLOWED_IMAGE_TYPES = ['jpeg', 'jpg', 'png', 'webp', 'gif'];

function claimedToMime(imgType: string): string | null {
  switch ((imgType || '').toLowerCase().replace(/^\./, '')) {
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return null;
  }
}

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

      // Verify the bytes are a real image of a supported format.
      const actual = sniffMimeType(value);
      if (!actual) {
        return 'Image data is not a supported format (jpeg, png, webp, gif)';
      }
      const claimed = claimedToMime(attachments.image_type);
      if (claimed && claimed !== actual) {
        return `image_type '${attachments.image_type}' does not match the actual image content (${actual})`;
      }
    } else if (key === 'image_type') {
      if (typeof value !== 'string') {
        return `Attachment '${key}' must be a string`;
      }
      if (!ALLOWED_IMAGE_TYPES.includes(value.toLowerCase().replace(/^\./, ''))) {
        return `image_type must be one of: ${ALLOWED_IMAGE_TYPES.join(', ')}`;
      }
    } else if (key === 'image_name') {
      if (typeof value !== 'string') {
        return `Attachment '${key}' must be a string`;
      }
      if (value.length > 200) {
        return `Attachment '${key}' is too long`;
      }
    }
  }

  return null;
}

// Pipeline cache (keyed by config)
const pipelineCache = new Map<string, IntentPipeline>();

function getPipeline(apiKey: string, customModel?: string, gateway?: ChatGateway, credentialId?: string): IntentPipeline {
  // SECURITY: the cache key MUST include the credential id — a gateway binds a
  // specific user's decrypted provider key, so two users selecting the same
  // provider+model must never share a cached pipeline (cross-user reuse).
  const gwKey = gateway ? `${gateway.providerId}:${gateway.model}:${credentialId || 'anon'}` : 'default';
  const cacheKey = `${apiKey}:${customModel || 'default'}:${gwKey}`;
  
  if (pipelineCache.has(cacheKey)) {
    return pipelineCache.get(cacheKey)!;
  }

  if (!gateway && (!apiKey || !apiKey.startsWith('gsk_'))) {
    throw new Error('Invalid Groq API key');
  }

  const registry = new AgentRegistry();
  registry.registerWorker('GeneralWorker', new GeneralWorker(apiKey, customModel, gateway));
  registry.registerWorker('WebWorker', new WebWorker(apiKey, customModel, gateway));
  registry.registerWorker('VisionWorker', new VisionWorker(apiKey, gateway));

  const pipe = new IntentPipeline(apiKey, registry, customModel, gateway);
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
    const { message, attachments = {}, customApiKey, customModel, history, providerId, conversationId } = req.body;

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

    // Provider selection (Phase 2/3): a user may route chat through their own
    // connected provider. providerId must reference an active credential owned
    // by the caller. When absent, the server-default Groq key is used.
    let gateway: ChatGateway | null = null;
    if (providerId) {
      if (!req.userId) {
        res.status(401).json({ error: 'Provider selection requires an authenticated session' });
        return;
      }
      gateway = await providerService.resolveGateway(req.userId, providerId);
      if (!gateway) {
        res.status(400).json({ error: 'Provider credential not found or not active' });
        return;
      }
      // Vision capability is handled inside the VisionWorker (it probes the
      // provider and falls back to vision models) — nothing to block here.
    }

    // Use custom API key if provided, otherwise use server default
    const apiKey = gateway
      ? ''
      : (customApiKey && customApiKey.startsWith('gsk_'))
        ? customApiKey
        : Settings.GROQ_API_KEY;

    if (!gateway && (!apiKey || !apiKey.startsWith('gsk_'))) {
      res.status(500).json({ error: 'No valid API key available. Please add your Groq API key in Settings.' });
      return;
    }

    // Plan gate: ALL authenticated clients (JWT sessions AND API-key callers)
    // are metered against the subscription tier. API-key clients additionally
    // carry their own per-key quota (enforced in the api-key middleware), so
    // the tighter of the two limits applies. Custom (user-supplied) Groq keys
    // do not bypass the tier.
    if (req.userId) {
      const quota = await enforceChatQuota(req.userId);
      if (!quota.ok) {
        res.status(429).json({
          error: `Daily request limit reached for your ${quota.planId === 'free' ? 'Free' : 'current'} plan (${quota.limit}/day). Upgrade to continue.`,
          code: 'plan_quota_exceeded',
          plan: quota.planId,
          limit: quota.limit,
          upgrade: true,
        });
        return;
      }
    }

    // Create pipeline with custom config if needed. The credential id is part
    // of the cache key so pipelines never leak between users/credentials.
    const pipe = getPipeline(apiKey, customModel, gateway || undefined, typeof providerId === 'string' ? providerId : undefined);
    const effectiveModel = gateway?.model || customModel || Settings.DEFAULT_MODEL;
    const started = Date.now();

    // Build a memory context block from client-supplied history (if any).
    // Clients send the last N turns; ConversationMemory truncates to a budget.
    // History is untrusted input: entries and per-turn content are capped so a
    // hostile client cannot inflate the prompt (MAX_MESSAGE_LENGTH only caps
    // the `message` field).
    const MAX_MEMORY_TURNS = 40;
    const MAX_MEMORY_TURN_CHARS = 4000;
    const recent = Array.isArray(history) ? history.slice(-MAX_MEMORY_TURNS) : [];
    let memoryBlock: string | undefined;
    if (recent.length > 0) {
      const mem = new ConversationMemory(20);
      for (const turn of recent) {
        if (turn && (turn.role === 'user' || turn.role === 'assistant') && typeof turn.content === 'string') {
          mem.add(turn.role, turn.content.slice(0, MAX_MEMORY_TURN_CHARS));
        }
      }
      memoryBlock = mem.buildContext({ maxTokens: 800, maxTurns: 12 });
    }

    if (req.userId) {
      recordChatUsage(req.userId);
    }

    const result = await pipe.process(message || '[Image attached] Analyze this image', attachments, memoryBlock);

    // Phase 5: persist the turn into the caller's conversation (ownership is
    // enforced by the store; the message list is capped server-side). Failures
    // are logged but never fail the chat response itself.
    let savedConversationTitle: string | null = null;
    if (req.userId && typeof conversationId === 'string' && conversationId) {
      try {
        const now = new Date().toISOString();
        const persisted = await persistConversationTurn(req.userId, conversationId, [
          {
            id: `${Date.now()}-user`, // stable-enough id for the demo store
            role: 'user',
            content: (message || '[Image attached] Analyze this image').slice(0, 50000),
            timestamp: now,
            attachments: attachments.image_name ? { image_name: attachments.image_name } : undefined,
          },
          {
            id: `${Date.now()}-sage`,
            role: 'assistant',
            content: result.response ? String(result.response).slice(0, 100000) : '',
            timestamp: new Date().toISOString(),
            intent: result.intent ? intentToDict(result.intent) : undefined,
            agent: result.agent || 'GeneralWorker',
            stages: result.stages || undefined,
          },
        ]);
        if (persisted) savedConversationTitle = persisted.title;
      } catch (error: any) {
        console.warn(`[chat] conversation persistence failed: ${error?.message}`);
      }
    }

    // Async usage tracking (never blocks the response). API-key callers were
    // already recorded by the api-key middleware — skip to avoid double rows.
    if (!req.apiKey) {
      recordUsage({
        userId: req.userId || null,
        endpoint: '/api/chat',
        model: effectiveModel,
        statusCode: result.success ? 200 : 200,
        latencyMs: Date.now() - started,
      }).catch(() => {});
    }

    res.json({
      success: result.success,
      response: result.response,
      agent: result.agent,
      intent: result.intent ? intentToDict(result.intent) : null,
      stages: result.stages,
      model: effectiveModel,
      provider: gateway ? gateway.providerId : 'default',
      conversationTitle: savedConversationTitle,
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
