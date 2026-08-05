-- ============================================================================
-- SAGE Migration 001 — Auth & Conversations (hardened)
-- Idempotent: safe to run on a fresh DB or on top of the original schema.sql.
--
-- What changed vs schema.sql:
--   1. users gains `password_hash` (the backend hashes passwords with scrypt
--      before they ever reach the DB — never store plaintext).
--   2. users gains `is_admin` + `banned_until` for the admin platform.
--   3. conversations.user_id FK to users(id) is DROPPED. The backend issues
--      JWTs with app-generated UUIDs and does not require a users row to exist
--      (demo + anonymous flows). The FK made inserts fail for those users.
--   4. RLS policies on conversations are REPLACED. The old `USING (true)`
--      policies let anyone with the anon key read/write every conversation.
--      The backend uses the service key (which bypasses RLS), so the correct
--      posture is: RLS enabled, no anon/authenticated policies (default deny).
--      See migrations/004_supabase_auth.sql when adopting Supabase Auth.
-- ============================================================================

-- ── users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  password_hash TEXT,                -- scrypt:<saltHex>:<hashHex> (backend-side)
  is_admin BOOLEAN NOT NULL DEFAULT false,
  banned_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Upgrade an existing users table (original schema.sql had no password_hash).
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;

-- ── conversations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,             -- JWT userId (no FK — see header note)
  title TEXT NOT NULL DEFAULT 'New Conversation',
  messages JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop the FK from the original schema so JWT-only users can persist chats.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversations_user_id_fkey' AND conrelid = 'conversations'::regclass
  ) THEN
    ALTER TABLE conversations DROP CONSTRAINT conversations_user_id_fkey;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

-- ── user_stats ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_queries INT DEFAULT 0,
  successful_queries INT DEFAULT 0,
  avg_response_time FLOAT DEFAULT 0,
  favorite_task_types TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── agent_logs (usage + audit trail) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  intent_id TEXT,
  task_type TEXT,
  agent_name TEXT,
  confidence_score FLOAT,
  response_time_ms INT,
  success BOOLEAN,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_user ON agent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON agent_logs(created_at DESC);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Enable on all app tables. The backend uses the service role key, which
-- bypasses RLS entirely, so nothing breaks. Anon/authenticated roles get
-- DEFAULT DENY (no policies) — this closes the old open-policy hole.
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Remove the permissive policies created by the original schema.
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON conversations;

-- ── Timestamp triggers ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS conversations_updated ON conversations;
CREATE TRIGGER conversations_updated
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS user_stats_updated ON user_stats;
CREATE TRIGGER user_stats_updated
  BEFORE UPDATE ON user_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS users_updated ON users;
CREATE TRIGGER users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
