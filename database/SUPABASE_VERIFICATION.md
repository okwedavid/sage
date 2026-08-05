# 🔎 SAGE — Supabase Production Verification Checklist

The deployed SAGE application already uses an **existing Supabase project**. This
document is the human-executed verification of that project. The code-level
inspection and migrations were completed autonomously (see
`database/migrations/`); the items below require **live credentials** (project
URL + service key) which are not available in this workspace.

> ⚠️ Run these checks against **production**, but never with destructive
> actions. All steps below are read-only or additive.

---

## 1. Environment variables (deployment platform)

| Variable | Required | Notes |
|----------|----------|-------|
| `SUPABASE_URL` | ✅ | e.g. `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | ✅ | service role key — **never** expose to the frontend |
| `SUPABASE_ANON_KEY` | optional | only if frontend talks to Supabase directly |
| `JWT_SECRET` | ✅ | **must not** be the default `sage-dev-secret` in production |
| `GROQ_API_KEY` | ✅ | must start with `gsk_` |
| `FRONTEND_URL` | ✅ | must include the deployed frontend origin |
| `NODE_ENV` | ✅ | `production` |
| `PORT` | ✅ | Railway injects this |

Verify in Railway/Vercel: open the service → Variables → confirm all above are
set and `SUPABASE_SERVICE_KEY` is masked.

## 2. Database schema

Run the migrations in order in the Supabase SQL Editor:

1. `database/migrations/001_auth_conversations.sql`
2. `database/migrations/002_api_platform.sql`
3. `database/migrations/003_supabase_auth.sql` *(optional — only for Supabase Auth adoption)*

Then verify:

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- expect: users, conversations, user_stats, agent_logs, api_keys, usage_events, audit_logs

SELECT column_name FROM information_schema.columns WHERE table_name = 'users';
-- expect: ... password_hash, is_admin, banned_until ...

SELECT conname FROM pg_constraint WHERE conname = 'conversations_user_id_fkey';
-- expect: no rows (FK dropped so JWT-only users can persist chats)
```

## 3. Row Level Security

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- expect rowsecurity = true for: users, conversations, user_stats, agent_logs, api_keys, usage_events, audit_logs

SELECT polname, tablename FROM pg_policies WHERE schemaname = 'public';
-- expect NO permissive policies on conversations (the old USING(true) policies must be gone)
```

**Posture:** RLS enabled + no anon/authenticated policies = default deny. The
backend's service key bypasses RLS, so the app is unaffected. This closes the
previous hole where anyone with the anon key could read all conversations.

## 4. Authentication

- Register a user via `POST /api/auth/register` → expect `201` with JWT.
- Confirm `users` row exists with a `password_hash` starting `scrypt:` (never the raw password).
- Log in via `POST /api/auth/login` → expect `200` + JWT.
- `GET /api/auth/me` with the token → expect the user object with `isAdmin`.
- Wrong password → `401`.

## 5. Conversations persistence

- Create a conversation → expect `201` with an `id`.
- Reload/restart the backend → the conversation must still be listed (persisted).
- Add a message → `201`; fetch the conversation → message present.
- Delete → `200`; fetch → `404`.

## 6. Storage buckets

The current app does **not** use Supabase Storage (images are sent to the
backend as base64 and analyzed by the vision worker). If you plan to store
uploaded media:

```sql
-- Run in the Supabase dashboard: Storage → New bucket
-- name: uploads  | public: false  | RLS: enable
```

## 7. Secrets hygiene

- Confirm the service key is **not** committed anywhere (`grep -r "SUPABASE_SERVICE_KEY" --include="*.ts" --include="*.js" --include="*.env*" .`)
- Confirm no `.env` files are tracked by git (`git ls-files | grep env`).
- Consider rotating the service key if it has ever been exposed.

## 8. Post-migration smoke test

```bash
cd backend
npm install
npm test          # 156+ tests must pass
npm run test:coverage
npm run build
NODE_ENV=production node dist/index.js   # boots, connects to Supabase
```

---

## Result: [ ] PASS  [ ] FAIL — issues found:

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | Env vars present | ☐ | |
| 2 | Migrations applied | ☐ | |
| 3 | RLS enabled, no open policies | ☐ | |
| 4 | Auth persists to DB | ☐ | |
| 5 | Conversations persist | ☐ | |
| 6 | Storage not required (base64 path) | ☐ | |
| 7 | Secrets not committed | ☐ | |
| 8 | Post-migration smoke test | ☐ | |
