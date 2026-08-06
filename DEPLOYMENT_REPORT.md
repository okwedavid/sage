# 🚀 DEPLOYMENT_REPORT — SAGE v1.1

**Date:** August 6, 2026 · **Branch:** `feature/v1.1-production-platform`
**Prepared by:** autonomous engineering agent (lead engineer)

---

## 1. Live deployment state (probed 2026-08-06)

| Component | URL | Status | Observed |
|-----------|-----|--------|----------|
| Frontend | `https://sage-delta-three.vercel.app` | ✅ 200 | Next.js app served |
| Backend  | `https://sage-backend.up.railway.app` | ✅ 200 | `SAGE v7.0` — endpoints: chat, auth, conversations, agents |

### Diagnosis: why the deployed app differs from the repository

The deployed backend answers `GET /` with **SAGE v7.0** and only four
endpoints. The repository (feature branch) is **17+ commits ahead** and ships
the API platform (`/api/keys`), admin console (`/api/admin`), metrics
(`/api/metrics`), organizations (`/api/organizations`), billing
(`/api/billing`), conversation memory, and the plugin layer. The live backend
is an **older build from before the v1.1 milestone** — it has not been
redeployed since those commits landed.

**Root cause:** the deploy pipeline is human-gated by design (CI never
auto-deploys). No Railway/Vercel deployment token is present in this
environment, so the redeploy must be triggered by a human with account access.

## 2. Local verification (already green)

- Backend tests: **370 passed** · Coverage **95.4% lines / 81.4% branches /
  99.3% functions** (thresholds enforced).
- Typecheck (app + tests) ✅ · ESLint ✅ · Frontend `next build` ✅
- `npm audit --omit=dev`: 1 moderate (uuid, non-exploitable — tracked).

## 3. Deploy plan (once credentials exist)

1. **Create + merge the PR** → `main` (human approval; CI runs on PR).
2. **Backend (Railway)** — service `sage-backend` redeploys from `main` when
   connected to GitHub, or via `railway up` from `backend/`.
   Required env vars (already present in local `.env.production`; verify in
   Railway):
   `PORT`, `NODE_ENV=production`, `GROQ_API_KEY`, `SAGE_DEFAULT_MODEL`,
   `SAGE_VISION_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JWT_SECRET`,
   `FRONTEND_URL`, `ADMIN_EMAILS` (optional).
3. **Frontend (Vercel)** — project `sage-delta-three` redeploys from `main`
   (root directory `frontend`). Set `NEXT_PUBLIC_API_URL` to the Railway URL
   and `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **Database (Supabase)** — run migrations in order in the SQL editor:
   `001_auth_conversations.sql` → `002_api_platform.sql` →
   `004_commercial_platform.sql` (003 optional, Supabase Auth only).
5. **CORS** — the backend allows `*.vercel.app` and `FRONTEND_URL`; ensure
   `FRONTEND_URL` is the real frontend origin in production.

## 4. Post-deploy smoke test checklist

- [ ] `GET <railway>/` → `SAGE v7.1`, endpoints incl. keys/admin/organizations/billing
- [ ] `POST /api/auth/register` + `POST /api/auth/login` → JWT
- [ ] `GET /api/chat/health` → groq `ok`, supabase `ok`
- [ ] `POST /api/chat` with JWT → 200; message persists to `usage_events`
- [ ] Image attachment → VisionWorker routing
- [ ] History array → response reflects conversation memory
- [ ] `POST /api/keys` → `sk_sage_` key; authenticate with it → 200
- [ ] `GET /api/billing/plan` → Free plan + quota
- [ ] `POST /api/organizations` → 201; invite a second registered user
- [ ] `GET /api/admin/summary` with an admin JWT → full dashboard payload
- [ ] Free-tier quota: 20 chat requests then 21st → 429 `plan_quota_exceeded`

## 5. Manual steps & credentials required (blocking)

### Accounts (existing, owner-held)
| Account | Needed for | Status |
|---------|-----------|--------|
| GitHub (`okwedavid/sage`) | PR creation + merge | ✅ repo reachable; push works |
| Railway | backend redeploy | 🔒 exists; no token available here |
| Vercel | frontend redeploy | 🔒 exists; no token available here |
| Supabase | schema migrations + live queries | 🔒 exists; keys in local `.env.production` |

### Credentials/API keys
| Item | Why | How to obtain |
|------|-----|---------------|
| `RAILWAY_TOKEN` | automated `railway up` or CI deploy | Railway dashboard → Account → Tokens |
| `VERCEL_TOKEN` | automated `vercel --prod` or CI deploy | Vercel → Account Settings → Tokens |
| `GROQ_API_KEY` | AI inference | https://console.groq.com (already configured) |
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | DB + service access | Supabase → Project Settings → API |
| `JWT_SECRET` (≥24 chars, not the dev default) | token signing | generate: `openssl rand -base64 32` |
| `ADMIN_EMAILS` (optional) | in-memory admin allow-list | set to your admin email |
| Stripe keys (future) | billing checkout/webhooks | Stripe account — see `COMMERCIAL_READINESS.md` |

### Step-by-step manual actions
1. **Create the PR**: open
   `https://github.com/okwedavid/sage/pull/new/feature/v1.1-production-platform`
   → base `main` → compare `feature/v1.1-production-platform` → "Create pull
   request" → add the release notes summary.
2. **Approve CI**: wait for the backend/frontend jobs (this release passes all
   gates locally; CI is identical).
3. **Merge** the PR into `main`.
4. **Apply migrations 001, 002, 004** in the Supabase SQL editor.
5. **Redeploy backend**: Railway dashboard → `sage-backend` → Deployments →
   Redeploy (or `railway up` with a token).
6. **Redeploy frontend**: Vercel dashboard → import latest `main` build (or
   `vercel --prod` with a token); confirm env vars.
7. **Run the smoke checklist (§4)** against the live URLs.
8. **Optionally enable CI deploys**: add `RAILWAY_TOKEN`/`VERCEL_TOKEN`
   secrets + a `production` GitHub environment (the `deploy` job in
   `.github/workflows/ci.yml` is already written, human-gated).

## 6. Conclusion

All autonomous work is complete and verified locally. The deployment is
**blocked only** on the human actions above (credentials + merge approval).
Nothing else stands between this release and production.
