# SESSIONS — Engineering Log

A chronological log of engineering sessions on the SAGE platform.

---

## Session 2026-08-09 — Milestone v1.3: Monetization + Account Security

**Branch:** `feature/v1.1-production-platform` (continued)

### Password reset (account recovery)
- `POST /api/auth/forgot-password` + `POST /api/auth/reset-password`:
  one-time SHA-256-hashed tokens (32-byte random), TTL (default 1h),
  single-use, all outstanding tokens revoked after success. Per-IP rate
  limits (env-tunable). Uniform 200 on unknown emails — no enumeration.
- Resend delivery (`services/email.ts`) — optional; without a key the reset
  link is returned as `devResetUrl` in non-production only, logged otherwise.
- Frontend auth modal: forgot/reset views, `?reset_token=…` deep-link with
  token stripped from URL history.

### Stripe billing (live)
- `services/stripe.ts`: `createCheckoutSession` (recurring pro/team prices),
  `createPortalSession`, `verifyWebhook` (raw-body signature check) and
  idempotent `processStripeEvent` over checkout/subscription/invoice events.
- `POST /api/billing/webhook` mounted as `express.raw` in `index.ts` so
  signatures verify against exact bytes. `stripe_events` dedupe table
  (migration 006) makes Stripe retries safe.
- Checkout/portal now live; still return the `payment_provider_not_configured`
  contract until the four Stripe env vars are set.

### Provider key rotation
- `ProviderService.rotateKey` — new key live-validated BEFORE it replaces the
  old one; bad keys never clobber working credentials. `POST
  /api/providers/:id/rotate` + Settings → Providers UI.

### Chat hardening
- Attachments must be an object; `image_type` whitelist; `image_name`
  bounded; history capped to last 40 turns.

### Delivery
- Changelog + release notes + API docs + env templates updated for v1.3.
  Suite: **550 tests / 55 files**, all passing; typecheck (app + tests) +
  lint clean; frontend build clean.

---

## Session 2026-08-08 — Milestone v1.2: BYO Providers + Memory + Security

**Branch:** `feature/v1.1-production-platform` (continued)

### Phase 1 — Natural conversation / classifier
- Added `CHAT` intent + `conversation-detector.ts`: greetings (`hello`, `hi`,
  `hey`, `good morning`, `how are you`, combined phrases) short-circuit to a
  deterministic conversational path and bypass the research confidence gate.
- Strict validation preserved for genuinely ambiguous tasks; existing
  research/web/vision routing untouched. Deterministic detector tests added.

### Phase 2/3 — Custom model / API provider system + unified schema
- `providers/` module: types, AES-256-GCM credential encryption
  (`credentials.ts`), adapter registry + catalog (OpenAI, Anthropic, Gemini,
  Groq, OpenRouter, OpenAI-compatible with custom `baseUrl`).
- Unified normalization layer (`gateway.ts`) — every provider response is
  normalized into SAGE's internal schema; the pipeline never knows the
  provider. New providers = new adapter, no core changes.
- `ProviderService` orchestration: connect (live validation), list (masked),
  model discovery, health checks, select-model, revoke. Migration `005`.
- Wired into classifier/pipeline/workers with gateway back-compat; chat route
  accepts `providerId`. Fixed a high-severity pipeline cache bug where the
  gateway cache was keyed only by adapter+model (credential now included).

### Phase 4 — Common image analysis
- Vision worker rewritten: attachment validation by **magic bytes** (JPEG/PNG/
  WEBP/GIF sniffs), model capability detection (vision-capable model routing
  on the same credential), graceful failure for text-only models.

### Phase 5/6 — Conversation memory + memory button
- Unified `conversation-store.ts` (Supabase + in-memory demo modes): auto-
  generated titles from first message, message caps (100), sanitized turns.
- Chat auto-persists every turn; conversations route refactored + rename
  endpoint; frontend Sidebar lists recent sessions with reopen + new
  conversation; Composer sends `conversationId`.

### Phase 7 — User API settings
- `ApiKeysSection` UI in Settings: create (plaintext once), masked list,
  copy, rotate, revoke, created/status/usage. Sage-issued keys (SHA-256 at
  rest) kept strictly separate from provider credentials. Docs in
  `docs/API.md`.

### Phase 8 — Subscription entry point
- Header button next to the profile avatar linking to the existing Billing
  page (billing-ready abstraction; no hardcoded payment credentials).

### Phase 9 — SAGE loading experience
- `SageLoading.tsx` — Sage-identity loading indicator rendered where the
  response body appears; visible while processing, removed on response/error.

### Phase 10 — API + security testing
- Provider suites: credentials (encryption round-trip, tamper detection),
  adapters (each provider, vision filtering, discovery), service (isolation,
  masking, lifecycle), gateway (normalization, retries, malformed responses),
  providers route (connect/list/models/health/revoke, secret-leak tests),
  vision-worker capability routing, conversation store (titles/caps/
  isolation/restoration), chat provider selection.
- Suite: **479 tests / 49 files**, coverage **92.5% stmts / 80.5% branches /
  94.25% funcs** — all thresholds met.

### Phase 11 — Production safety
- Reviewed by code-reviewer: fixed cross-user gateway cache key, combined
  greeting patterns, request-size limits on provider connect, response size
  bounds; redaction of provider keys in all error surfaces.

### Phase 12 — Docs + delivery
- `docs/API.md` added; README endpoints/env/architecture updated; changelog +
  release notes updated for v1.2.

---

## Session 2026-08-06 — Milestone v1.1: Commercial Platform

**Branch:** `feature/v1.1-production-platform` → pushed to `origin`

### Phase 0 — Version control
- Reviewed and committed the in-flight AI foundation work (conversation
  memory, prompt orchestration, worker metrics) as `f8f3dda`.
- Pushed the feature branch to GitHub (17 commits + new work ahead of `main`).
- PR creation URL surfaced for human action
  (`https://github.com/okwedavid/sage/pull/new/feature/v1.1-production-platform`).

### Phase 1 / 6 — Deployment assessment
- Probed the live deployment: frontend `https://sage-delta-three.vercel.app`
  (200), backend `https://sage-backend.up.railway.app` (200) — the deployed
  backend reports **SAGE v7.0** with only chat/auth/conversations/agents
  endpoints, i.e. it predates the API platform, admin console, and this
  release. The live site is therefore **behind** the repository.
- Redeploy requires Railway + Vercel credentials (tokens) — **manual step**,
  documented in `DEPLOYMENT_REPORT.md`.

### Phase 2 — Production audit
- Ran the full verification suite: typecheck (app + tests) ✅, lint ✅ (fixed
  1 unused-import warning), frontend build ✅, `npm audit` → 1 moderate
  (uuid, non-exploitable, tracked).
- Raised the test suite from 289 → **370 tests** and restored all coverage
  thresholds (95.4% lines / 81.4% branches / 99.3% functions).

### Phase 3 — Commercial platform
- Billing-ready architecture: `004_commercial_platform.sql` (organizations,
  members, plans, subscriptions, invoices + seed catalog), `services/billing.ts`
  (plan resolution, usage counting, quota enforcement), `routes/billing.ts`
  (catalog / my plan / checkout + portal provider hooks).
- Organizations: `services/organizations.ts` + `routes/organizations.ts`
  (CRUD, invitations, roles, plan gates) — both Supabase + in-memory fallback.
- Quota enforcement wired into `/api/chat` (429 + upgrade) and API-key
  creation (plan cap).
- Frontend: Organizations page, Billing page (plan comparison + live usage
  meter), sidebar + routing, API client methods.

### Phase 5 — Platform strategy
- Plugin architecture: `agents/plugin.ts` (AgentManifest, global store, claim
  matching), registry routing priority with domain awareness, AgentFinance
  scaffold, `/api/agents` plugin surfacing.
- Docs: `docs/PLUGIN_ARCHITECTURE.md`, `docs/AGENTFINANCE_SPEC.md`.

### Phase 4 — Investor quality
- New pages built to the design system (glass cards, motion, gradients);
  versioning updated to v7.1 across sidebar/settings/engine.

### Delivered artifacts
- `RELEASE_NOTES.md`, updated `CHANGELOG.md`, `DEPLOYMENT_REPORT.md`,
  `COMMERCIAL_READINESS.md`, `SESSIONS.md` (this file).

---

## Prior sessions (summary)

- **2026-08-05** — Production hardening: 156-test suite, security fixes
  (scrypt passwords, 400/413/403 mapping, input limits), coverage tooling,
  `PRODUCTION_READINESS.md`. (v1.0.0-beta)
- **2026-08-01** — Personal Groq API keys + model selection; vision worker
  model fallback chain. (v7.1 informal)
- **2026-07-20** — Core platform: 5-stage intent pipeline, three workers,
  auth, conversations, Supabase service layer, mission-control UI. (v7.0)
