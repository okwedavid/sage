-- ============================================================================
-- SAGE Migration 002 — API Platform
-- Tables for the API-first platform: API keys, usage tracking, audit logs.
-- Idempotent.
-- ============================================================================

-- ── api_keys ────────────────────────────────────────────────────────────────
-- Only the last 8 chars of the key are stored (`key_suffix`); the full key is
-- hashed (SHA-256) for lookup. The plaintext key is shown exactly once at
-- creation time.
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,                    -- owner (JWT userId)
  name TEXT NOT NULL DEFAULT 'Default Key',
  key_hash TEXT UNIQUE NOT NULL,            -- sha256 of the full key
  key_suffix TEXT NOT NULL,                 -- last 8 chars for display
  scopes TEXT[] NOT NULL DEFAULT '{chat}',  -- e.g. {chat}, {chat,conversations}
  quota_per_day INT NOT NULL DEFAULT 1000,  -- daily request quota
  requests_today INT NOT NULL DEFAULT 0,
  quota_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active',    -- active | revoked
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- ── usage_events ────────────────────────────────────────────────────────────
-- One row per API request. Basis for quotas, billing and the admin dashboard.
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  model TEXT,
  status_code INT,
  latency_ms INT,
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  cost_usd NUMERIC(12, 8) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_key ON usage_events(api_key_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events(created_at DESC);

-- ── audit_logs ──────────────────────────────────────────────────────────────
-- Immutable trail of sensitive operations (key create/rotate/revoke, admin
-- actions, logins). Written via the service key; never modified afterwards.
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_type TEXT NOT NULL,                 -- user | api_key | system
  actor_id TEXT,
  action TEXT NOT NULL,                     -- e.g. api_key.created, admin.user_banned
  resource TEXT,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- Service-key only access (default deny for anon/authenticated).
