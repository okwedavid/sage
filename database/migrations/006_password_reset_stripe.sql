-- ============================================================================
-- SAGE Migration 006 — Password Reset & Stripe webhook idempotency
--
-- 1. password_resets — one-time, expiring reset tokens. Only the SHA-256
--    hash of the token is stored (never the token itself). Rows are consumed
--    (used_at set) on successful reset and expire after a short TTL.
-- 2. stripe_events — dedupe table for Stripe webhook deliveries. The event id
--    (primary key) records that a webhook event was already processed so
--    retries are idempotent.
--
-- Idempotent, service-key access (RLS default deny) consistent with 001–005.
-- ============================================================================

-- ── password_resets ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,                -- owner (JWT userId)
  token_hash TEXT UNIQUE NOT NULL,      -- sha256 hex of the reset token
  expires_at TIMESTAMPTZ NOT NULL,      -- hard expiry (default 1h)
  used_at TIMESTAMPTZ,                  -- set when the token is consumed
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets(expires_at);

ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- ── stripe_events (webhook idempotency) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,                  -- Stripe event id
  type TEXT NOT NULL,                   -- e.g. checkout.session.completed
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
