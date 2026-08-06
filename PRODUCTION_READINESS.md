# 🏭 SAGE Backend — Production Readiness Report

**Date:** August 5, 2026 · **Version assessed:** 7.0 · **Build:** backend

---

## 1. Executive Summary

The SAGE backend is **substantially production-ready** for a demo/beta workload
after this hardening pass. The intent pipeline core is fully covered (100%),
all previously-fixed bugs are pinned by regression tests, the HTTP surface is
covered end-to-end, and several real defects were found and fixed (plaintext
passwords, 500s for malformed input, blocked-CORS returning 500, unbounded
input sizes, and an out-of-range-confidence crash path).

**Test suite: 156 tests · 22 files · all passing · coverage 97% lines / 90% branches.**

Two **structural gaps** remain that need *human decisions*, not just code:
(1) auth and conversations are in-memory (data loss on restart; no cross-instance
state), and (2) there is no CI pipeline enforcing the test/coverage gates.

---

## 2. Test Coverage Statistics

> Measured with `vitest run --coverage` (v8 provider, thresholds enforced in `vitest.config.ts`).

| Area | Lines | Branches | Functions |
|------|-------|----------|-----------|
| **All files** | **97.2%** | **89.6%** | **100%** |
| `core/intent` (pipeline, classifier, normalizer, validator, router, schemas, enums) | 100% | 100% | 100% |
| `middleware/auth` | 100% | 100% | 100% |
| `services/supabase` | 100% | 94% | 100% |
| `agents` (registry, general, web, vision) | 99.5% | 85% | 100% |
| `routes` (chat, auth, conversations, agents) | 92.7% | 77% | 100% |
| `config/settings` | 98% | 87% | 100% |
| `index.ts` (server bootstrap) | 85% | 88% | 100% |

Thresholds: lines/statements/functions ≥ 90%, branches ≥ 80% — **all met**.
The only uncovered lines are defensive error paths (e.g. `app.listen` bootstrap,
crypto failure catch blocks) that are exercised only by impossible inputs.

### Suite breakdown

| Category | Tests | Purpose |
|----------|-------|---------|
| Intent core (7 files) | 45 | Pipeline, classifier, normalizer, validator, router, schemas, enums |
| Regression | 13 | Pins every bug fixed in earlier sessions |
| Security (core + app) | 18 | Injection, clamping, proto pollution, malformed JSON/body, CORS, rate limit |
| Concurrency | 4 | Shared-pipeline isolation under 20–50 parallel requests |
| Performance/load | 5 | Throughput budgets, ReDoS guard, memory sanity |
| Workers | 21 | Registry, General/Web/Vision with mocked LLM + fetch |
| Routes (integration) | 31 | Chat, auth, conversations, agents via the real express app |
| Middleware | 7 | JWT auth + optional auth |
| Services | 9 | Supabase persistence (configured/unconfigured, success/error) |

---

## 3. What Was Fixed This Session

### Security & correctness (found by the new tests)
1. **Plaintext passwords** → scrypt-hashed with per-user salt (`node:crypto`, zero new deps). Login verifies via `timingSafeEqual`.
2. **Malformed JSON → 500** → now **400**; **oversized bodies → 500** → now **413** (body-parser error mapping).
3. **Blocked CORS origins → 500** → now **403** with a proper message.
4. **No input limits on `/api/chat`** → message length cap (`MAX_MESSAGE_LENGTH`, default 50k) and attachment validation (must be an object; `image_base64` must be base64 within `MAX_ATTACHMENT_BYTES`, default 8MB).
5. **Rogue LLM confidence** (e.g. `9000`) crashed the pipeline via `createIntent` → classifier now clamps to [0, 1]; non-numeric falls back to 0.85.
6. **`app.listen()` on import** → guarded by `require.main === module`; the app is now importable for tests and tools.
7. **Minimum password length (6)** enforced at `/api/auth/register`; `RATE_LIMIT_MAX=0`/invalid env values can no longer brick the limiter; CORS-error detection in the error handler is exact-message (not substring).

### Operations
7. Rate limit window/max are now env-configurable (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`).
8. Dead dependency `node-fetch` removed (global `fetch` was already in use).
9. `npm audit fix` applied: the high-severity `undici` advisory (via cheerio) is patched.
10. New scripts: `test:coverage`, `typecheck`, `typecheck:tests`. New docs: `TESTING.md`, this report.

### Test infrastructure
11. Coverage tooling (`@vitest/coverage-v8`) with **enforced thresholds**.
12. Shared HTTP helpers (`src/test-utils/http.ts`) — boot the real app on an ephemeral port, no extra test deps.
13. **Test files are now typechecked** via `tsconfig.test.json` + `npm run typecheck:tests` (previously excluded from `tsc` — caught 3 latent type errors on the first run).
14. 11 new test files; total suite grew from 44 → **156 tests**.

---

## 4. Architecture Review

### Strengths
- **Clean layered separation**: routes → core/intent (pipeline stages) → agents (workers) → services. Each stage owns one concern and is independently testable.
- **Forward-only status lifecycle** (`RECEIVED → … → COMPLETED`, `FAILED` terminal) enforced by `canAdvanceStatus` and tested.
- **Graceful degradation everywhere**: classifier and every worker fall back to safe outputs on LLM failure; the pipeline converts exceptions into `System Error` responses instead of crashing.
- **Deterministic routing**: registry-based worker lookup with sane fallbacks; image attachments route to VisionWorker with a model retry loop.
- **Defense-in-depth**: helmet, rate limiting, CORS allow-list, scrypt, input limits, output-format fixed to MARKDOWN for all user content.

### Weaknesses / scalability concerns
1. **In-memory state (biggest)**: `routes/auth.ts` users and `routes/conversations.ts` conversations are `Map`s. Every restart wipes accounts and chats; multiple backend instances (horizontal scale) have divergent state. The Supabase service layer exists (`services/supabase.ts`) but **is not wired into the routes**.
2. **Per-instance caches/limits**: pipeline cache and rate-limit counters are in-memory per process. Fine for one instance; needs Redis or sticky sessions for scale-out.
3. **No structured logging or metrics**: `console.log` only; no request IDs, no correlation with LLM calls, no error tracking. The production observability story is "read Railway logs".
4. **No graceful shutdown** (SIGTERM handling), no dependency health checks (only a self-health endpoint).
5. **Pipeline has no overall timeout**: `WebWorker.fetchPage` has a 12s timeout, but the Groq calls have none — a hung LLM request hangs the HTTP request indefinitely.
6. **Auth rate limiting is global**: the 100 req/15-min limit is per IP across all `/api/*`, so it throttles everything but provides weak brute-force protection on `/api/auth/login` specifically.
7. **Anonymous chat by design**: `/api/chat` uses `optionalAuth` and the frontend can supply its own Groq key — fine for the product model, but it means the backend can't bill/rate-limit per user; abuse protection relies on the IP limiter.
8. **`JWT_SECRET` has a hardcoded dev fallback** (`sage-dev-secret`); a production deploy that forgets the env var is trivially forgeable.
9. **`zod` is a dependency but no runtime validation uses it** — request bodies are validated by hand. Zod usage should either be removed or adopted for schemas (low priority).
10. **Frontend/backend version skew risk**: `APP_VERSION` is a constant in settings, not derived from package.json.

---

## 5. Remaining Risks (prioritized)

| # | Risk | Sev. | Impact | Mitigation status |
|---|------|------|--------|-------------------|
| R1 | In-memory auth + conversations → data loss on restart, no multi-instance | **High** | Production accounts vanish on deploy | Needs decision: wire Supabase routes (work planned below) or accept for beta |
| R2 | No CI enforcing tests/coverage | **High** | Regressions ship silently | Add GitHub Actions workflow (blocker: repo config access) |
| R3 | No pipeline/LLM timeouts | **Med** | Hung Groq call = hung request, resource exhaustion | Add `AbortSignal.timeout` to Groq calls |
| R4 | `JWT_SECRET` dev fallback | **Med** | Token forgery if env missing in prod | Add a production startup guard that refuses to boot with the default secret |
| R5 | `uuid` moderate advisory (v3/v5/v6 buffer check) | **Low** | Not exploitable — app uses `v4()` only | Tracked; upgrade to v14 is a breaking change |
| R6 | Dev-tooling esbuild advisories (vitest) | **Low** | Dev-only, not deployed | Tracked; upgrade to vitest 4 when convenient |
| R7 | Global rate limit weak for login brute-force | **Med** | Credential stuffing on `/api/auth/login` | Add a stricter per-route limiter on auth |
| R8 | No graceful shutdown / dep health checks | **Low** | Ports held open, degraded ops | Add SIGTERM handler |

---

## 6. Blockers Requiring Human Input

1. **Supabase wiring decision.** Wire `routes/auth.ts` + `routes/conversations.ts` to the Supabase service (real accounts + persisted chats) or keep in-memory for the demo? This changes deployment requirements (Supabase project mandatory) and the auth flow.
2. **CI provider.** Which CI (GitHub Actions, Railway CI, Vercel) should run `npm test` + `npm run test:coverage` as a gate? Needs repo-level configuration.
3. **Model/key strategy.** Are users expected to bring their own Groq keys (current default), or should the backend own a single pooled key with per-user quotas? Affects auth, billing, and rate-limit design.
4. **Version bump.** This session changes behavior (400/413/403 codes, password hashing). Should `APP_VERSION` move to 7.1 (with an `UPDATE_v7.1.md` note)?

---

## 7. Prioritized Action Plan

### P0 — do before public launch
- [ ] Wire Supabase persistence into auth + conversations routes (after B1 decision)
- [ ] Add startup guard: refuse to boot in production with the default `JWT_SECRET`
- [ ] Add per-route rate limiter for `/api/auth/login` (e.g. 10/min/IP)
- [ ] Add timeouts to all Groq calls (classifier + workers) via `AbortSignal`

### P1 — should do
- [ ] CI workflow: `npm test` + `npm run test:coverage` + `tsc --noEmit` gate
- [ ] SIGTERM graceful shutdown + simple request logging middleware (method, path, status, ms)
- [ ] Extract CORS allow-list + secrets to a `.env.production.example` committed template
- [ ] Remove or adopt `zod` for request-body schemas
- [ ] Test the full build path: `npm run build` → `node dist/index.js` smoke test

### P2 — nice to have
- [ ] Structured logging (pino) with request IDs
- [ ] Dependency health endpoint (`/api/chat/health` extended with Groq/Supabase latency)
- [ ] Bump `APP_VERSION` to 7.1 + changelog
- [ ] Upgrade vitest 1.x → 4.x (clears dev advisories) and uuid (clears R5)
- [ ] Redis-backed rate limiting + pipeline cache for horizontal scale

---

## 8. How to Reproduce

```bash
cd backend
npm install
npm test                 # 156 tests, all pass
npm run test:coverage    # enforces ≥90% lines/statements/functions, ≥80% branches
npm run typecheck        # app code typecheck
npm run typecheck:tests  # test files typecheck
npm run build            # production emit (tsc → dist)
npm audit --omit=dev     # prod deps: 1 moderate (uuid, not exploitable in use)
```
