# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Payment provider (Stripe) integration via the checkout/webhook contract.
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
