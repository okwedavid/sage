-- ============================================================================
-- SAGE Migration 003 — (OPTIONAL) Supabase Auth adoption
-- ============================================================================
-- This migration is NOT required. The backend currently issues its own JWTs
-- (signed with JWT_SECRET) and persists users in the `users` table with
-- scrypt-hashed passwords. That design works today and is fully covered by
-- tests.
--
-- If you later switch to Supabase Auth (email magic links / OAuth), run this
-- to bridge the two identity systems, then change `JWT_SECRET` handling to
-- verify Supabase JWTs (HS256 with the project's JWT secret) instead of the
-- app secret.
-- ============================================================================

-- Bridge: link app users to Supabase Auth users.
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID;
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- Example RLS policies once Supabase Auth is the source of truth.
-- Uncomment after enabling Supabase Auth and backfilling auth_id:
--
-- CREATE POLICY "conversations_select_own" ON conversations
--   FOR SELECT USING (
--     user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
--   );
-- CREATE POLICY "conversations_insert_own" ON conversations
--   FOR INSERT WITH CHECK (
--     user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
--   );
-- CREATE POLICY "conversations_update_own" ON conversations
--   FOR UPDATE USING (
--     user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
--   );
-- CREATE POLICY "conversations_delete_own" ON conversations
--   FOR DELETE USING (
--     user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
--   );
