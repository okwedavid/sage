/**
 * config/settings.ts
 * OWNS: Central configuration (env → typed constants)
 * EXPOSES: Settings singleton
 * FORBIDDEN: Business logic
 */
import dotenv from 'dotenv';
dotenv.config();

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

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'sage-dev-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Pipeline
  CONFIDENCE_THRESHOLD: 0.4,

  // App Meta
  APP_NAME: 'SAGE',
  APP_VERSION: '7.0',
  APP_TAGLINE: 'Systemic Agentic General Engine',

  validate(): boolean {
    return this.GROQ_API_KEY.startsWith('gsk_');
  },

  getMaskedKey(): string {
    const key = this.GROQ_API_KEY;
    if (key.length > 8) return `${key.slice(0, 6)}...${key.slice(-4)}`;
    return 'NOT SET';
  },
} as const;
