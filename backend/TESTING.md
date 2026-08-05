# 🧪 SAGE Backend — Testing Guide

## Quick Start

```bash
cd backend

# Run the full test suite (watch mode)
npm test

# Run once and exit
npx vitest run

# Run with coverage (enforces thresholds)
npm run test:coverage

# Run a single file
npx vitest run src/core/intent/pipeline.test.ts

# Typecheck (test files are excluded from the build tsconfig)
npx tsc --noEmit
```

## Coverage

Coverage is collected with the v8 provider and **enforced** via thresholds in
`vitest.config.ts`:

| Metric     | Threshold | Current |
|------------|-----------|---------|
| Lines      | 90%       | 97%     |
| Statements | 90%       | 97%     |
| Functions  | 90%       | 100%    |
| Branches   | 80%       | 90%     |

Run `npm run test:coverage` — the command exits non-zero if any threshold is
missed, so CI can treat it as a gate. An HTML report is written to
`backend/coverage/` (open `coverage/index.html` in a browser).

## Test Layout

Tests live **next to the code** they exercise (`src/**/*.test.ts`):

| Suite                      | Covers                                                        |
|----------------------------|---------------------------------------------------------------|
| `core/intent/*.test.ts`    | Normalizer, classifier, validator, router, schemas, pipeline  |
| `core/intent/regression`   | Every previously fixed bug (must never regress)               |
| `core/intent/security`     | Injection, confidence clamping, proto pollution, hostile LLM  |
| `core/intent/concurrency`  | Parallel `process()` isolation on a shared pipeline           |
| `core/intent/performance`  | Throughput budgets (generous — only fail on regressions)      |
| `agents/*.test.ts`         | Registry, GeneralWorker, WebWorker, VisionWorker              |
| `routes/*.test.ts`         | Chat, auth, conversations, agents endpoints (real app + fetch)|
| `routes/security.test.ts`  | Malformed JSON, oversized bodies, CORS, rate limiting, headers |
| `middleware/auth.test.ts`  | JWT auth middleware                                          |
| `services/supabase.test.ts`| Persistence layer with mocked client                         |

## Conventions

- **No network**: the Groq SDK is always mocked (`vi.mock('groq-sdk', ...)`),
  `fetch` is stubbed via `vi.stubGlobal`, and Supabase is mocked. Tests are
  deterministic and run offline.
- **Shared helpers**: `src/test-utils/http.ts` provides `withServer()` (boots
  the app on an ephemeral port) and `jsonFetch()`.
- **Mock state**: use `vi.hoisted()` for state the mock factory needs, and
  reset it in `afterEach` so it cannot leak between tests.
- **Fresh app instances**: tests that need different env (rate limits, CORS,
  missing API keys) use `vi.resetModules()` + `vi.stubEnv()` + dynamic
  `await import('../index')`.
- **Beware module-level state**: `routes/auth.ts` users map, `routes/chat.ts`
  pipeline cache, and `services/supabase.ts` client cache persist per test
  file (each file runs in its own process) — design tests around that.

## Hardening covered by tests

- Malformed JSON → **400**, oversized body → **413** (not 500)
- Blocked CORS origins → **403** in production
- Rate limit exceeded → **429**
- Messages over `MAX_MESSAGE_LENGTH` and invalid/oversized attachments → **400**
- Passwords hashed with scrypt (never stored in plaintext)
- LLM confidence scores clamped to [0, 1]
- Pipeline is safe under concurrent load and stateless across runs
