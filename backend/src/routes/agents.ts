/**
 * routes/agents.ts
 * OWNS: Agent info + management endpoints
 */
import { Router, Request, Response } from 'express';
import { Settings } from '../config/settings';

const router = Router();

const AGENTS = [
  {
    name: 'GeneralWorker',
    description: 'Text research, explain, debug, build, plan',
    icon: '🧠',
    color: '#667eea',
    status: 'active',
  },
  {
    name: 'WebWorker',
    description: 'URL fetch + web content analysis',
    icon: '🌐',
    color: '#58a6ff',
    status: 'active',
  },
  {
    name: 'VisionWorker',
    description: 'Image analysis via multimodal LLM',
    icon: '👁️',
    color: '#a78bfa',
    status: 'active',
  },
  {
    name: 'AudioWorker',
    description: 'Voice transcription & TTS (Coming Sprint 7)',
    icon: '🎤',
    color: '#3fb950',
    status: 'planned',
  },
  {
    name: 'ImageGenWorker',
    description: 'Image generation (Coming Sprint 11)',
    icon: '🎨',
    color: '#f093fb',
    status: 'planned',
  },
];

// GET /api/agents
router.get('/', (_req: Request, res: Response) => {
  res.json({ agents: AGENTS });
});

// GET /api/agents/status
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    engine: `SAGE v${Settings.APP_VERSION}`,
    model: Settings.DEFAULT_MODEL,
    apiKey: Settings.getMaskedKey(),
    validated: Settings.validate(),
    agents: AGENTS.filter((a) => a.status === 'active').map((a) => a.name),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

export default router;
