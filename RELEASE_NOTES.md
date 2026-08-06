# SAGE v1.1 — Release Notes

**Milestone:** v1.1 Production Platform · **Branch:** `feature/v1.1-production-platform`
**Date:** August 6, 2026 · **Engine version:** SAGE v7.1

---

## 🎯 What this release delivers

SAGE moves from a working demo to a **commercially viable AI platform**:
a complete API platform, an admin console, conversation memory, worker
observability, multi-tenant organizations, a billing-ready subscription
architecture, and a plugin system for vertical agents (AgentFinance first).

**Quality gate:** 370 backend tests · 95.4% lines / 81.4% branches /
99.3% functions coverage (thresholds enforced in CI) · frontend builds clean.

---

## ✨ New in v1.1

### API Platform
- **API keys** — create / list / rotate / revoke with `sk_sage_` keys, SHA-256
  hashed at rest, shown in plaintext exactly once.
- **Scopes & quotas** — per-key scopes (`chat`, `conversations`, `admin`) and
  per-day request quotas with rollover-aware counting.
- **Usage tracking** — every request recorded to `usage_events` (endpoint,
  latency, model, cost) for metering and billing.

### Admin Console
- **Dashboard** — users, requests, error rates, API usage, costs, engine
  health, memory, per-worker performance (runs / errors / avg latency).
- **User moderation** — suspend/restore accounts, full conversation visibility,
  audit + agent log viewers.
- **Audit trail** — logins, registrations, key lifecycle, admin actions, org
  events, and billing checkouts.

### AI Foundation
- **Conversation memory** — rolling-window, token-aware context built from
  client history; sanitized, capped, and injected into every worker prompt.
- **Prompt orchestration** — one source of truth (`buildSystemPrompt` /
  `buildUserPrompt`) across General, Web, and Vision workers with a shared
  safety preamble.
- **Worker metrics** — per-worker execution latency and error flags recorded
  by the pipeline and surfaced in the admin dashboard.

### Commercial Platform (billing-READY)
- **Organizations** — multi-tenant workspaces with owner/admin/member roles,
  invitations by email, leave/remove/delete flows, enforced per-plan limits.
- **Subscription plans** — Free / Pro / Team catalog with daily request
  quotas, org caps, and API-key caps.
- **Quota enforcement** — `/api/chat` meters authenticated users against their
  tier (429 + upgrade signal when exhausted); API-key creation respects plan
  caps.
- **Billing endpoints** — public plans catalog, per-user plan + usage, and
  checkout/portal hooks that return the exact contract a payment provider
  (Stripe) will fulfill. No provider credentials are required to ship this.

### Platform Extensibility
- **Plugin architecture** — typed `AgentManifest` + registry integration:
  plugins claim task types (+ domains) and win routing ahead of built-ins,
  inheriting auth, billing, memory, metrics, and audit automatically.
- **AgentFinance scaffold** — the first vertical agent, designed as a SAGE
  plugin (see `docs/AGENTFINANCE_SPEC.md`).

### Production Infrastructure
- CI workflow: build, lint, typecheck (app + tests), full tests, coverage
  gate, `npm audit`, and human-gated deploy preparation.
- Production config guard, graceful shutdown, structured request logging with
  request IDs, extended health endpoint, per-route auth rate limits, Groq
  timeouts + retry with backoff, scrypt password hashing.

---

## 📦 What was verified

- Backend: 370 tests across 40 files — all passing; coverage thresholds met.
- TypeScript typechecks (app + tests) clean; ESLint clean; `npm audit` has
  one moderate (uuid, non-exploitable — tracked).
- Frontend production build succeeds (Next.js 14).

## 🚀 Deployment notes

- The **deployed** backend (`sage-backend.up.railway.app`) is running the
  older v7.0 build and **does not yet include** this release. Deploying
  requires Railway/Vercel credentials (see `DEPLOYMENT_REPORT.md`).
- Database migration `004_commercial_platform.sql` must be applied to
  Supabase before enabling organizations/billing in production.

## 🧭 Recommended next steps

1. Create the PR to `main` and merge (human approval).
2. Apply migrations 001–004 to the production Supabase project.
3. Wire a payment provider (Stripe) using the checkout/webhook contract.
4. Build the AgentFinance worker (`createWorker`) and flip it to `beta`.

---

_Built with ❤️ by the SAGE team — Think. Understand. Act. Evolve._
