/**
 * src/index.ts — SAGE Backend Entry Point
 * OWNS: Express server initialization + route mounting
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Settings } from './config/settings';
import { logger, requestLogger } from './services/logger';
import { metrics } from './services/metrics';
import chatRoutes from './routes/chat';
import authRoutes from './routes/auth';
import conversationRoutes from './routes/conversations';
import agentRoutes from './routes/agents';

const app = express();

// ── Disable Railway's proxy CORS interference ──
app.disable('x-powered-by');

// ── Security ──
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow cross-origin resources
}));

// ── Observability: structured request logging + request IDs ──
app.use(requestLogger);

// ── Observability: per-endpoint metrics ──
app.use((req, res, next) => {
  const start = Date.now();
  // Capture the path synchronously: Express's parseurl cache can hold a
  // router-stripped path by the time 'finish' fires.
  const path = req.originalUrl.split('?')[0];
  res.on('finish', () => {
    metrics.record(path, res.statusCode, Date.now() - start);
  });
  next();
});

// CORS - Allow multiple origins in production
const allowedOrigins = [
  Settings.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'https://sage-delta-three.vercel.app',
].filter(Boolean);

// Allow any Vercel deployment (*.vercel.app)
const isVercelOrigin = (origin: string) => origin.endsWith('.vercel.app');

app.use(
  cors({
    origin: function (origin, callback) {
      console.log(`[CORS] Request from origin: ${origin || 'no-origin'}`);
      
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list OR is a Vercel deployment
      if (allowedOrigins.includes(origin) || isVercelOrigin(origin)) {
        console.log(`[CORS] ✅ Allowed: ${origin}`);
        return callback(null, true);
      }
      
      // In development, be lenient
      if (Settings.NODE_ENV !== 'production') {
        console.log(`[CORS] ⚠️ Dev mode - allowing: ${origin}`);
        return callback(null, true);
      }
      
      // In production, reject unknown origins
      console.log(`[CORS] ❌ Blocked: ${origin}`);
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Access-Control-Allow-Origin'],
  })
);

// ── Explicitly set CORS headers to override Railway proxy ──
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || isVercelOrigin(origin))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// ── Rate Limiting ──
const limiter = rateLimit({
  windowMs: Settings.RATE_LIMIT_WINDOW_MS,
  max: Settings.RATE_LIMIT_MAX,
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

// ── Monitoring: metrics snapshot (admin/ops) ──
app.get('/api/metrics', (_req, res) => {
  res.json(metrics.snapshot());
});

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
      metrics: '/api/metrics',
    },
  });
});

// ── Error Handler ──
// Maps body-parser and CORS failures to proper status codes instead of 500.
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON body' });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Payload too large' });
    return;
  }
  if (typeof err?.message === 'string' && err.message.startsWith('The CORS policy for this site')) {
    res.status(403).json({ error: err.message });
    return;
  }
  logger.error('unhandled error', { requestId: req.id, message: err?.message, stack: err?.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ──
// Only listen when run directly (node dist/index.js / tsx src/index.ts),
// so importing `app` for tests never binds a port.
/* v8 ignore start */
if (require.main === module) {
  // Production boot guard: refuse to start with an insecure configuration.
  if (Settings.NODE_ENV === 'production') {
    const problems = Settings.assertProductionSafe();
    if (problems.length > 0) {
      console.error('❌ Refusing to start in production — configuration problems:');
      for (const p of problems) console.error(`   • ${p}`);
      process.exit(1);
    }
  }

  const server = app.listen(Settings.PORT, () => {
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

  // Graceful shutdown: stop accepting connections, drain, then exit.
  const shutdown = (signal: string) => {
    logger.info(`received ${signal}, shutting down gracefully`);
    server.close(() => {
      logger.info('server closed');
      process.exit(0);
    });
    // Force-exit if connections refuse to drain within 10s.
    setTimeout(() => {
      logger.error('forced exit after shutdown timeout');
      process.exit(1);
    }, 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
/* v8 ignore stop */

export default app;
