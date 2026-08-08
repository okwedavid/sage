-- ============================================================================
-- SAGE Migration 005 — Provider Credentials (user-supplied third-party AI keys)
--
-- Users connect their own AI provider API keys (OpenAI, Anthropic, Gemini,
-- Groq, OpenRouter, OpenAI-compatible endpoints). Keys are encrypted at rest
-- (AES-256-GCM) by the backend before INSERT; this table NEVER stores or
-- returns plaintext keys.
--
-- RLS is enabled; access is service-key only (default deny), consistent with
-- the other platform tables. The backend enforces per-user ownership in the
-- query layer AND via user-scoped route handlers.
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,                     -- owner (JWT userId)
  provider TEXT NOT NULL,                    -- groq | openai | anthropic | gemini | openrouter | openai-compatible
  label TEXT NOT NULL DEFAULT '',            -- user-facing name
  encrypted_key TEXT NOT NULL,               -- AES-256-GCM ciphertext (iv.authTag.ciphertext)
  base_url TEXT,                             -- custom endpoints (openai-compatible)
  model TEXT,                                -- currently selected model
  capabilities JSONB DEFAULT '{}'::jsonb,    -- e.g. {"vision": true} for custom endpoints
  status TEXT NOT NULL DEFAULT 'active',     -- active | error
  last_checked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_credentials_user ON provider_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_credentials_provider ON provider_credentials(provider);

ALTER TABLE provider_credentials ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS provider_credentials_updated ON provider_credentials;
CREATE TRIGGER provider_credentials_updated
  BEFORE UPDATE ON provider_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
