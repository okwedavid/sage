# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-08-09

### Added
- **Password reset** — `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` with one-time, expiring SHA-256-hashed tokens (migration `006`), per-IP rate limits, account-enumeration-safe responses, and Resend transactional email delivery (`RESEND_API_KEY`). In non-production without SMTP the reset link is returned as `devResetUrl`; the frontend auth modal gains forgot/reset views and deep-links via `?reset_token=…`.
- **Stripe billing (live)** — the v1.1 checkout/portal hooks are now real: `createCheckoutSession` (recurring prices), billing portal, and a signature-verified webhook (`POST /api/billing/webhook`) handling `checkout.session.completed`, `subscription.updated/deleted`, and invoice events, with `stripe_events` idempotency (migration `006`). Activates in test mode when `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`STRIPE_PRICE_PRO`/`STRIPE_PRICE_TEAM` are set; otherwise returns the documented `payment_provider_not_configured` contract.
- **Provider key rotation** — `POST /api/providers/:id/rotate`: the new key is live-validated against the provider *before* it replaces the old one, so a bad key can never clobber a working credential. UI in Settings → Providers.
- **Chat hardening** — attachments must be an object; `image_type` restricted to jpg/jpeg/png/webp/gif; `image_name` length-bounded; oversized history capped to the last 40 turns.

### Security
- Reset tokens are 32-byte random values; only their SHA-256 hash is persisted; single-use with TTL (default 1h) and post-success revocation of all outstanding tokens.
- Forgot-password returns a uniform response whether or not the account exists (no user enumeration); production never returns the reset link in the API response.
- Stripe webhook payloads verified via `constructEvent` (raw body), invalid signatures → 400; events idempotently deduped so Stripe retries are safe.
- Reset/forgot endpoints rate-limited per IP (env-tunable).

### Fixed
- Provider key rotation previously required revoke + reconnect; now atomic and validated.
- Billing docs/env now reflect real Stripe wiring instead of the placeholder contract.

### Verified
- Backend: **550 tests / 55 files** passing; typechecks (app + tests) + lint clean; frontend build + lint clean.

## [1.2.0] - 2026-08-08

### Added
- **Natural conversation**: new `CHAT` intent with a deterministic detector — greetings (`hello`, `hi`, `hey`, `good morning`, `how are you`, combined phrases) are classified conversationally and bypass the research confidence gate instead of being rejected. Strict validation for genuinely ambiguous tasks is preserved.
- **BYO provider system (Phases 2/3)**: users connect their own API credentials for OpenAI, Anthropic, Google Gemini, Groq, OpenRouter, and any OpenAI-compatible endpoint (custom `baseUrl`). AES-256-GCM encryption at rest (`SAGE_CREDENTIAL_ENCRYPTION_KEY`), live credential validation, model discovery, health checks, model selection, and revocation. New `providers/` module + migration `005`.
- **Unified model schema**: `ChatGateway` adapter architecture normalizes every provider response into SAGE's internal schema — the pipeline is provider-agnostic, and new providers are added via a single adapter without touching core logic.
- **Common image analysis (Phase 4)**: vision worker now validates attachments by magic bytes (JPEG/PNG/WEBP/GIF), detects model vision capability and routes to a vision-capable model on the same credential, and fails gracefully for text-only models.
- **Conversation memory completion (Phases 5/6)**: unified conversation store (Supabase + demo), auto-generated titles from message context, 100-message cap, per-turn sanitization, automatic persistence on every chat turn, rename endpoint, and frontend session list with reopen/new-conversation controls.
- **User API settings (Phase 7)**: Settings UI to create (plaintext once), view masked, copy, rotate, revoke Sage API keys with created/status/usage metadata. Sage-issued keys (SHA-256 at rest) are strictly separated from user-supplied provider keys.
- **Subscription entry point (Phase 8)**: header button beside the profile avatar linking to the existing billing page.
- **SAGE loading experience (Phase 9)**: `SageLoading` indicator styled on the Sage identity, shown where the response appears and removed on completion/error.
- **API documentation**: `docs/API.md` — authentication (JWT vs `sk_sage_…`), chat, providers, conversations, billing, and security guarantees.

### Changed
- Chat route accepts `providerId` (use a connected provider) and auto-persists conversation turns.
- Classifier/pipeline/workers accept an optional gateway while preserving the default Groq path for back-compat.
- Vision worker rewritten around capability detection rather than a fixed model chain.
- Conversations route refactored onto the unified store; titles generated automatically.
- README updated: endpoint table, provider architecture, `SAGE_CREDENTIAL_ENCRYPTION_KEY`.

### Security
- Provider keys encrypted at rest (AES-256-GCM); keys never returned, logged, or echoed in errors (`safeError` redaction for `sk-…`, `gsk_…`, `xai-…`, `AIza…`).
- Fixed cross-user gateway cache bug (cache keyed by adapter+model only — credential identity now included).
- Provider-connect request fields length-bounded; malformed provider responses bounded before normalization.

### Fixed
- Greetings rejected by the research confidence gate → now classified as `CHAT`.
- Common images (PNG/WEBP/GIF) failing or misrouting → magic-byte validation + capability routing.
- Gateway cache leaking one user's credential to another user on the same adapter+model.

### Verified
- Backend: **479 tests / 49 files** passing; coverage **92.5% statements / 80.5% branches / 94.25% functions** (thresholds enforced).
- Backend lint + typechecks (app + tests) clean; frontend lint clean, typecheck clean, production build succeeds.

## [1.1.0] - 2026-08-06

### Added
- **Commercial platform (billing-READY)**: subscription plans (Free/Pro/Team) with daily request quotas, `plans`/`subscriptions`/`invoices` tables (migration 004), per-user quota enforcement on `/api/chat` (429 + upgrade signal), API-key plan caps, billing endpoints (catalog, my plan + usage, provider-gated checkout/portal hooks).
- **Organizations**: multi-tenant workspaces with owner/admin/member roles, email invitations, leave/remove/delete flows, per-plan organization limits (migration 004 + routes + frontend page).
- **Plugin architecture**: typed `AgentManifest` + registry routing priority (plugin claims beat built-ins), global plugin store, `AgentFinance` scaffold (`agents/plugins/agentfinance.ts`), surfaced in `/api/agents`. Docs: `docs/PLUGIN_ARCHITECTURE.md`, `docs/AGENTFINANCE_SPEC.md`.
- **Conversation memory**: `ConversationMemory` service (rolling window, token-aware), pipeline memory hook attaching client-supplied history as context, chat route history sanitization (role whitelist, caps), frontend Composer sends recent turns.
- **Prompt orchestration**: `services/prompts.ts` — shared `buildSystemPrompt`/`buildUserPrompt` across General/Web/Vision workers with a unified safety preamble.
- **Worker metrics**: per-worker runs/errors/avg-latency recorded by the pipeline and displayed in the admin dashboard.
- **API platform**: API key management (create/rotate/revoke), usage tracking, per-key quotas and rate limits, audit logging, secure API-key middleware.
- **Admin platform**: monitoring dashboard for users, requests, API usage, costs, system health, conversations, and logs; user disabling.
- **Production infrastructure**: environment validation, graceful shutdown, structured request logging, extended health endpoint, CI workflow (build, lint, test, coverage, typecheck, audit).

### Changed
- Engine version reported as **SAGE v7.1** (`APP_VERSION`).
- `AgentRegistry.lookup` accepts an optional domain and consults registered plugins first.
- `/api/agents` now returns `plugins` alongside built-in agents.
- The vision/web workers consume conversation memory context; all workers use the shared prompt builders.
- Sidebar/settings display SAGE v7.1; new Organizations and Billing pages added to navigation.

### Security
- Chat history is untrusted input: capped (40 turns, 4000 chars/turn) and role-whitelisted before entering the prompt.
- Plan quotas enforced server-side (chat + API keys + organizations); demo mode applies the Free tier.

## [Unreleased]

### Planned
- AgentFinance worker implementation (finance data provider + premium gate).

## [1.0.0-beta] - 2026-08-05

### Added
- **Intent pipeline test suite (vitest)**: 156 tests across 22 files covering the intent core (normalizer, classifier, validator, router, schemas, pipeline, enums), all workers (general, web, vision, registry), all routes (chat, auth, conversations, agents), JWT middleware, and the Supabase persistence layer.
- **Security test suite**: prompt injection, hostile Unicode, confidence clamping, prototype-pollution attempts, malformed/empty LLM output, malformed JSON → 400, oversized bodies → 413, blocked CORS origins → 403, rate limiting → 429, helmet security headers.
- **Concurrency tests**: 20–50 parallel `process()` calls on a shared pipeline proving request isolation and failure containment.
- **Performance/load tests**: throughput budgets for normalization and pipeline runs, ReDoS guard, memory sanity checks.
- **Regression tests**: pin every previously-fixed bug (emoji whitespace, whitespace-only input, supplemental emoji ranges, forward/backward lifecycle transitions, terminal statuses).
- **Test infrastructure**: `vitest.config.ts` with enforced coverage thresholds (lines/statements/functions ≥ 90%, branches ≥ 80%), `@vitest/coverage-v8`, `tsconfig.test.json` + `typecheck:tests` script (test files now typechecked), shared HTTP test helpers.
- **Coverage tooling & docs**: `TESTING.md`, `PRODUCTION_READINESS.md`, npm scripts `test:coverage`, `typecheck`, `typecheck:tests`.
- Frontend: pinned `@next/swc-win32-x64-msvc` for reliable local installs on Windows.

### Changed
- **Auth**: passwords are now scrypt-hashed with per-user salt and verified via `timingSafeEqual` (previously stored in plaintext). Minimum password length of 6 enforced at registration.
- **HTTP error mapping**: malformed JSON now returns **400**, oversized bodies **413**, blocked CORS origins **403** (previously all returned 500).
- **Input limits**: `/api/chat` enforces `MAX_MESSAGE_LENGTH` (default 50k) and validates attachments (`image_base64` must be valid base64 within `MAX_ATTACHMENT_BYTES`, default 8MB).
- **Classifier**: LLM-reported confidence scores are clamped to [0, 1] (a rogue score previously crashed the pipeline); non-numeric confidence falls back to 0.85.
- **Normalizer**: emoji removal now re-collapses whitespace (no double spaces), the empty-input guard catches whitespace-only strings, and emoji ranges cover supplemental pictographs (U+1F900–1F9FF, U+1FA70–1FAFF) plus the FE0F variation selector.
- **Rate limiting**: window and max are now env-configurable (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`) with guards against invalid/zero values.
- **Server bootstrap**: `app.listen()` only runs when the file is executed directly (`require.main === module`), making the app importable for tests and tooling.
- **Dependencies**: removed unused `node-fetch` (global `fetch` already in use); applied `npm audit fix` (high-severity undici advisory patched); added `@vitest/coverage-v8`.

### Fixed
- Plaintext password storage → scrypt hashing.
- 500 responses for malformed JSON, oversized payloads, and blocked CORS origins → proper 400/413/403 codes.
- Rogue LLM confidence scores crashing the intent pipeline.
- Unbounded message/attachment sizes on `/api/chat`.
- Emoji removal leaving double spaces; whitespace-only input bypassing validation; newer emoji (U+1F9E0+) not stripped.
- `app.listen()` binding a port on import (blocked testing and tooling).
- Three latent type errors in test files (caught by the new `typecheck:tests` gate).

### Security
- No plaintext credentials stored; timing-safe password verification.
- JWT-based auth with helmet, CORS allow-list, and rate limiting.
- Input validation on all user-facing fields before they reach the pipeline.

### Infrastructure
- `engines.node >= 20` declared for the backend.
- Production `.env.production` loading layered over committed defaults.
- Railway + Vercel deployment configuration (existing).

## [7.1] - 2026-08-01 (informal)

### Added
- Personal LLM API key support: users can supply their own Groq key in Settings; custom model selection.
- Image analysis via VisionWorker with model fallback chain.

## [7.0] - 2026-07-20 (informal)

### Added
- Systemic Agentic General Engine: 5-stage intent pipeline (normalize → classify → validate → route → execute) with confidence thresholding.
- Worker architecture: GeneralWorker, WebWorker (page fetching + extraction), VisionWorker (image analysis).
- Conversation CRUD, user registration/login (JWT), agent list endpoint.
- Supabase persistence layer (service client + schema) with graceful fallback when unconfigured.

[1.0.0-beta]: https://github.com/sage/sage/releases/tag/v1.0.0-beta
