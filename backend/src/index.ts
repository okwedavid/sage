/**
 * src/index.ts — SAGE Backend Entry Point
 * OWNS: Express server initialization + route mounting
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Settings } from './config/settings';
import chatRoutes from './routes/chat';
import authRoutes from './routes/auth';
import conversationRoutes from './routes/conversations';
import agentRoutes from './routes/agents';

const app = express();

// ── Security ──
app.use(helmet());
app.use(
  cors({
    origin: Settings.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

// ── Rate Limiting ──
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// ── Body Parsing ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ──
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/agents', agentRoutes);

// ── Root ──
app.get('/', (_req, res) => {
  res.json({
    name: Settings.APP_NAME,
    version: Settings.APP_VERSION,
    tagline: Settings.APP_TAGLINE,
    status: 'operational',
    endpoints: {
      chat: '/api/chat',
      auth: '/api/auth',
      conversations: '/api/conversations',
      agents: '/api/agents',
    },
  });
});

// ── Error Handler ──
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ──
app.listen(Settings.PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║  SAGE v${Settings.APP_VERSION} — Backend API             ║
  ║  Systemic Agentic General Engine         ║
  ║                                          ║
  ║  🚀 http://localhost:${Settings.PORT}              ║
  ║  📡 Model: ${Settings.DEFAULT_MODEL.slice(0, 28)} ║
  ║  🔑 API: ${Settings.getMaskedKey().padEnd(28)}  ║
  ╚══════════════════════════════════════════╝
  `);
});

export default app;
