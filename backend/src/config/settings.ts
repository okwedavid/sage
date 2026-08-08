/**
 * config/settings.ts
 * OWNS: Central configuration (env → typed constants)
 * EXPOSES: Settings singleton
 * FORBIDDEN: Business logic
 */
import dotenv from 'dotenv';

// Load .env (dev defaults), then .env.production to fill gaps when in production.
// dotenv never overrides variables already present in process.env, so injected
// env vars (Railway/Vercel) always take precedence over committed files.
// Skipped under vitest (VITEST is set) so tests never absorb a local
// .env.production file's secrets into process.env (test hermeticity).
dotenv.config();
if (process.env.NODE_ENV === 'production' && !process.env.VITEST) {
  dotenv.config({ path: '.env.production' });
}

export const Settings = {
  // Server
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Groq AI
  GROQ_API_KEY: (process.env.GROQ_API_KEY || '').trim(),
  DEFAULT_MODEL: process.env.SAGE_DEFAULT_MODEL || 'llama-3.3-70b-versatile',
  VISION_MODEL: process.env.SAGE_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
  VISION_FALLBACK: 'llama-3.2-90b-vision-preview',
  MAX_TOKENS: 1024,
  VISION_MAX_TOKENS: 1500,

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',

  // Provider credential encryption (user-supplied third-party AI API keys)
  // Required in production before users can connect external providers.
  SAGE_CREDENTIAL_ENCRYPTION_KEY: process.env.SAGE_CREDENTIAL_ENCRYPTION_KEY || '',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'sage-dev-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Rate limiting (guarded so invalid/zero env values can't disable or brick the limiter)
  RATE_LIMIT_MAX: Math.max(1, parseInt(process.env.RATE_LIMIT_MAX || '100', 10) || 100),
  RATE_LIMIT_WINDOW_MS: Math.max(
    1000,
    parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10) || 15 * 60 * 1000
  ),
  // Stricter per-route limiter for auth endpoints (login/register brute-force)
  LOGIN_RATE_LIMIT_MAX: Math.max(1, parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10', 10) || 10),
  LOGIN_RATE_LIMIT_WINDOW_MS: Math.max(
    1000,
    parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || String(60 * 1000), 10) || 60 * 1000
  ),

  // Groq LLM timeout (ms) — a hung model call must never hang the HTTP request
  GROQ_TIMEOUT_MS: Math.max(1000, parseInt(process.env.GROQ_TIMEOUT_MS || '30000', 10) || 30000),

  // Input limits (security)
  MAX_MESSAGE_LENGTH: parseInt(process.env.MAX_MESSAGE_LENGTH || '50000', 10),
  MAX_ATTACHMENT_BYTES: parseInt(process.env.MAX_ATTACHMENT_BYTES || String(8 * 1024 * 1024), 10),

  // Pipeline
  CONFIDENCE_THRESHOLD: 0.4,

  // App Meta
  APP_NAME: 'SAGE',
  APP_VERSION: '7.1',
  APP_TAGLINE: 'Systemic Agentic General Engine',

  validate(): boolean {
    return this.GROQ_API_KEY.startsWith('gsk_');
  },

  getMaskedKey(): string {
    const key = this.GROQ_API_KEY;
    if (key.length > 8) return `${key.slice(0, 6)}...${key.slice(-4)}`;
    return 'NOT SET';
  },

  /**
   * Returns a list of configuration problems that must be fixed before a
   * production boot. Empty array = safe to start. Called by the bootstrap
   * guard in index.ts (production only).
   */
  assertProductionSafe(): string[] {
    const problems: string[] = [];
    if (this.JWT_SECRET === 'sage-dev-secret' || this.JWT_SECRET.length < 24) {
      problems.push('JWT_SECRET must be a strong random secret (default dev secret refused in production)');
    }
    if (!this.GROQ_API_KEY.startsWith('gsk_')) {
      problems.push('GROQ_API_KEY is missing or invalid (must start with gsk_)');
    }
    if (Boolean(this.SUPABASE_URL) !== Boolean(this.SUPABASE_SERVICE_KEY)) {
      problems.push('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set together');
    }
    if (this.FRONTEND_URL.includes('localhost')) {
      problems.push('FRONTEND_URL must be the deployed frontend origin in production');
    }
    return problems;
  },
} as const;
