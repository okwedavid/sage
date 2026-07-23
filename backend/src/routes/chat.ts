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

// Pipeline singleton (lazy init)
let pipeline: IntentPipeline | null = null;

function getPipeline(): IntentPipeline {
  if (pipeline) return pipeline;

  const apiKey = Settings.GROQ_API_KEY;
  if (!apiKey || !apiKey.startsWith('gsk_')) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const registry = new AgentRegistry();
  registry.registerWorker('GeneralWorker', new GeneralWorker(apiKey));
  registry.registerWorker('WebWorker', new WebWorker(apiKey));
  registry.registerWorker('VisionWorker', new VisionWorker(apiKey));

  pipeline = new IntentPipeline(apiKey, registry);
  return pipeline;
}

// POST /api/chat — process a message through the pipeline
router.post('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { message, attachments = {} } = req.body;

    if (!message?.trim() && Object.keys(attachments).length === 0) {
      res.status(400).json({ error: 'Message or attachment required' });
      return;
    }

    const pipe = getPipeline();
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
