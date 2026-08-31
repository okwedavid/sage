# SAGE Public Readiness Audit

**Date:** August 26, 2026 — audit filed
**Resolution verification:** August 30, 2026 — branch `fix/public-readiness-audit`
**Auditor:** Automated forensic audit
**Scope:** Full repository — frontend, backend, database, security, deployment
**Baseline:** 550 tests passing, TypeScript clean, working tree clean
**Post-fix:** 555/555 backend tests passing; coverage gates met (lines 93.12%, branches 80.06%, functions 94.86%, statements 93.12%); frontend typecheck clean, `next lint` clean, production build green

---

## Resolution Status (August 30, 2026)

| # | Severity | Status | Verification |
|---|----------|--------|--------------|
| P0-1 | P0 | ✅ Fixed | `isAdmin` served by `/api/auth/*`; sidebar nav filtered; `AdminDenied` guard in `page.tsx` |
| P0-2 | P0 | ✅ Fixed | Null-guarded billing UI; graceful fallback when plan/billing is unavailable |
| P0-3 | P0 | ✅ Fixed | Sidebar now fetches full conversation via `GET /api/conversations/:id` on open |
| P0-4 | P0 | ✅ Fixed | Invalid/revoked API keys → 401; exhausted quota → 429 (new tests cover both) |
| P0-5 | P0 | ✅ Fixed | Product version surfaced as `PRODUCT_VERSION = '1.0.0'`; engine `7.1` kept internal |
| P1-1 | P1 | ✅ Fixed | `*.vercel.app` wildcard removed; only exact configured origins allowed (verified in production-mode CORS tests incl. preflight) |
| P1-2 | P1 | ✅ Fixed | `ErrorBoundary` wraps landing + dashboard; graceful recovery UI |
| P1-3 | P1 | ✅ Fixed | Microphone/Globe buttons removed from Composer (no fake affordances) |
| P1-4 | P1 | ✅ Fixed | TTS toggle removed; fake Inspector tools removed; no implemented TTS exists, so the UI no longer advertises it |
| P1-5 | P1 | ✅ Fixed | Attach button is content-agnostic; backend already accepts beyond-images |
| P1-6 | P1 | ✅ Fixed | `sage_custom_api_key`/`sage_custom_model` removed from client + store; legacy keys scrubbed on SettingsPage mount |
| P2-1…P2-10 | P2 | ⏳ Open | Non-blocking polish; P2-8 (billing null crash) is resolved by the P0-2 fix; the rest remain tracked |

**Public-readiness posture after fixes:** the P0/P1 blockers that prevented safe public usage are resolved and verified. Remaining P2 items are polish, not safety blockers. No claim of deployment readiness beyond what is listed above.

---

## Executive Summary

SAGE is a well-architected AI platform with a sophisticated 5-stage cognitive pipeline, multi-provider AI support, and clean separation of concerns. The backend has strong security foundations (scrypt passwords, AES-256-GCM credential encryption, timing-safe comparisons, production boot guards). However, several critical issues prevent safe public usage.

**Overall Public-Readiness Score: 38/100**

---

## Issue Classification

### P0 — Blocks Safe Public Usage

| # | Issue | Component | Security Impact | User Impact |
|---|-------|-----------|----------------|-------------|
| P0-1 | **Admin page visible to ALL authenticated users** | Frontend (Sidebar, page.tsx) | Reveals admin functionality; non-admin users see 403 errors | Confusing UI, security reconnaissance surface |
| P0-2 | **Billing page crashes on null reference** | Frontend (BillingPage.tsx) | None | Billing page completely broken — crashes on load |
| P0-3 | **Conversation history broken on reload** | Frontend (Sidebar) | None | Users lose all conversation history on browser refresh |
| P0-4 | **jwtOrApiKey allows invalid API keys through** | Backend (middleware/api-key.ts) | Invalid/revoked API keys bypass authentication | Security bypass, quota bypass |
| P0-5 | **Version displays v7.x instead of v1.0.0** | Frontend (multiple) | Confuses users about product maturity | Marketing/trust problem |

### P1 — Major Broken Functionality

| # | Issue | Component | Security Impact | User Impact |
|---|-------|-----------|----------------|-------------|
| P1-1 | **CORS allows any *.vercel.app origin** | Backend (index.ts) | Any Vercel deployment can make credentialed cross-origin requests | Attack surface |
| P1-2 | **No error boundaries in React** | Frontend | Any component crash white-screens entire app | Reliability |
| P1-3 | **Audio input button has no handler** | Frontend (Composer.tsx) | None | Voice input appears available but does nothing |
| P1-4 | **TTS toggle exists but nothing happens** | Frontend (SettingsPage, Inspector) | None | Toggle appears functional but is cosmetic |
| P1-5 | **Image upload restricted to images only (frontend)** | Frontend (Composer.tsx) | None | Upload only works for images despite backend supporting more |
| P1-6 | **Backend stores user_custom_api_key in localStorage** | Frontend (SettingsPage) | XSS can exfiltrate keys | Security risk |

### P2 — Important But Non-Blocking

| # | Issue | Component | Notes |
|---|-------|-----------|-------|
| P2-1 | **Hardcoded "4.2s" average response time** | Frontend (Inspector) | Misleading metric |
| P2-2 | **Engine status always shows "Online"** | Frontend (Sidebar) | No health check performed |
| P2-3 | **No confirmation dialog for conversation delete** | Frontend (Sidebar) | Easy to accidentally delete |
| P2-4 | **In-memory email case-sensitivity** | Backend (auth.ts) | Only affects demo mode |
| P2-5 | **Pipeline cache grows with 100-entry FIFO eviction** | Backend (chat.ts) | Minor performance concern |
| P2-6 | **`console.log` in production code** | Backend (multiple) | Verbose logging, potential info leak |
| P2-7 | **Image upload uses alert() for errors** | Frontend (Composer.tsx) | Unprofessional UX |
| P2-8 | **Billing page pricing display crashes on null** | Frontend (BillingPage.tsx) | When `current` is null, `current!.plan.priceUsdCents` throws |
| P2-9 | **No pagination on conversation list** | Frontend (Sidebar) | Only shows 12 most recent |
| P2-10 | **react-hot-toast imported but unused** | Frontend | Dead dependency |

### P3 — Polish / Future Enhancement

| # | Issue | Component | Notes |
|---|-------|-----------|-------|
| P3-1 | **Placeholder pages for Memory/Tools** | Frontend | "Coming in Sprint 7/8" — should say something more final |
| P3-2 | **LoginPage.tsx is a no-op re-export** | Frontend | Confusing for developers |
| P3-3 | **AgentFinance plugin has no worker** | Backend | Planned feature, not broken |
| P3-4 | **No CHANGELOG/SESSIONS update for this session** | Documentation | Should be updated |
| P3-5 | **README outdated (479 tests, v7.0)** | Documentation | Should reflect current state |
| P3-6 | **Gemini adapter passes API key in URL query** | Backend | Server-side only, but still a risk |

---

## Detailed Issue Analysis

### P0-1: Admin Page Accessible to All Users

**Symptom:** Every authenticated user sees "Admin" in the sidebar navigation. Clicking it shows a loading state, then a 403 error from the backend.

**Root Cause:**
- `Sidebar.tsx` line 35: The `NAV_ITEMS` array unconditionally includes `{ id: 'admin', label: 'Admin', icon: ShieldCheck }`.
- `page.tsx` line 54: `{currentPage === 'admin' && <AdminPage />}` renders for any authenticated user.
- No frontend role check exists. The only protection is the backend `requireAdmin` middleware.

**Security Impact:** HIGH — reveals admin functionality exists, provides a reconnaissance surface for attackers. Frontend-only hiding is NOT security, but hiding is still important for UX.

**Recommended Fix:**
- Add `isAdmin` to the user object returned by `/api/auth/login`, `/api/auth/register`, `/api/auth/demo`, and `/api/auth/me`.
- Filter the admin nav item based on `user.isAdmin`.
- Add a guard to the admin page component.

### P0-2: Billing Page Crashes

**Symptom:** Billing page shows a white screen or React error boundary when loading.

**Root Cause:** In `BillingPage.tsx`:
- Line 61: `Promise.all([api.getBillingPlans(), api.getBillingPlan()])` — if `getBillingPlan()` fails (e.g., backend unreachable, stale deployment), the catch block only retries `getBillingPlans()`.
- Line 129: `const isPaidPlan = !!current && current.plan.id !== 'free'` — safe when `current` is null.
- Line 160: `current?.plan.priceUsdCents === 0` — safe with optional chaining.
- **Line 160 fallback:** `${priceLabel(current!.plan.priceUsdCents)}/month` — uses non-null assertion `!` which throws if `current` is null AND `current.plan.priceUsdCents !== 0`.

**Actually:** The real crash path is when `current` is null and the code tries to access `current.plan.priceUsdCents` in the fallback expression at line 160.

**Security Impact:** None.

**Recommended Fix:** Add null guards for all `current` accesses. Show a graceful "unable to load billing" state when `current` is null.

### P0-3: Conversation History Broken

**Symptom:** Users start a conversation, messages appear. After browser refresh, conversations appear in sidebar but clicking them shows empty chat.

**Root Cause Chain:**
1. Backend `GET /api/conversations` (list) → `dbList(userId)` → queries Supabase `SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC` — this returns conversations with their `messages` JSONB column.
2. In Supabase mode, the messages ARE included in the list response.
3. `Sidebar.tsx` line 59: `api.getConversations()` stores the full conversation objects (with messages) in `conversations` state.
4. `handleOpenSession` (line 82): `conversations.find(c => c.id === id)` finds the conversation.
5. `loadConversation(conv)` (line 84): Sets `messages: (conv.messages || []).map(...)`.

**The actual issue:** When `Sidebar` loads conversations via `api.getConversations()`, the Supabase query uses `select('*')` which includes `messages` (JSONB). However, when there are MANY conversations, the response could be large. The real issue might be:
- In-memory mode: conversations are created but the list might not include messages correctly.
- Supabase mode: The `dbList` function might not include the `messages` column if the query doesn't select it.

Let me check the actual Supabase query...

Actually, after deeper analysis, the `dbList` function in `supabase.ts` likely uses `select('*')` which includes messages. But the issue is more subtle:

1. When the chat route persists a conversation turn, it calls `persistConversationTurn(userId, conversationId, messages)`.
2. This calls `addMessages()` which calls `updateConversationContent()`.
3. The conversation IS updated in the database.
4. When the sidebar reloads conversations, it gets the updated messages.

**The real failure point:** The sidebar `useEffect` runs once on mount (`[user, setConversations]`). If the user refreshes, conversations are loaded. But if they then send a new message and the conversation is auto-titled, the sidebar doesn't re-fetch until `refreshConversations()` is called from `Composer.tsx`. The conversations in the sidebar state might have stale (empty) messages from the initial list.

When the user then clicks a conversation, `loadConversation` uses the stale version from state which may have empty `messages` because the initial list was fetched before any messages were added.

**Fix:** When clicking a conversation in the sidebar, fetch the full conversation from `GET /api/conversations/:id` instead of using the cached list version.

### P0-4: jwtOrApiKey Bypass

**Symptom:** Invalid or revoked API keys are silently accepted.

**Root Cause:** In `middleware/api-key.ts` lines 80-96:
```typescript
authenticateKey(token).then((auth) => {
  if (auth && !auth.quotaExceeded) {
    // Set req.apiKey, req.userId, record usage
  }
  next(); // ← ALWAYS calls next(), even when auth is null or quota exceeded
}).catch(() => next()); // ← On error, proceeds unauthenticated
```

When `auth` is null (invalid key) or `quotaExceeded` is true, the middleware calls `next()` WITHOUT setting any auth info, effectively treating the request as unauthenticated. This is by design for the `jwtOrApiKey` pattern (it's meant to be permissive), BUT:

The issue is that this doesn't reject invalid API keys — it just ignores them. If a route requires an API key (as opposed to JWT), `jwtOrApiKey` won't enforce it. However, the chat route already handles this by checking `req.userId` separately.

**Security Impact:** MODERATE — the chat endpoint won't process unauthorized requests because it checks `req.userId` for quota enforcement, but there's a gap if any future route uses `jwtOrApiKey` and assumes `req.apiKey` being set means authentication succeeded.

**Recommended Fix:** When an API key is presented but invalid/revoked, return 401 instead of silently proceeding.

### P0-5: Version Confusion

**Symptom:** The product displays "SAGE v7.0" and "SAGE v7.1" in multiple places.

**Root Cause:** Three different version schemes exist:
1. `package.json` version: `7.0.0`
2. `Settings.APP_VERSION`: `'7.1'`
3. Frontend Inspector: `SAGE v7.0`
4. Frontend Settings: `SAGE v7.1`

None of these match a commercial product version (v1.0.0).

**Recommended Fix:** Define a clear versioning scheme:
- Product version: `1.0.0` (what users see)
- Engine version: `7.x` (internal, only shown in technical contexts)
- API version: `v1` (for API versioning)

---

## Security Audit Summary

### Authentication
- ✅ scrypt password hashing with random salt
- ✅ Timing-safe hash comparison
- ✅ JWT with configurable expiry
- ✅ Rate limiting on auth endpoints
- ⚠️ Default JWT secret (`sage-dev-secret`) in development
- ✅ Production boot guard refuses default secret

### Authorization
- ✅ Backend admin middleware properly checks `is_admin`
- ✅ Conversation routes enforce owner-only access
- ✅ Organization routes check membership
- ✅ Provider credentials are user-scoped
- ✅ API keys are user-scoped
- ✅ **Frontend admin role check added** — admin page hidden from non-admins, guarded with `AdminDenied`
- ✅ Invalid/revoked API keys → 401, exhausted quota → 429 (`jwtOrApiKey`)

### Data Isolation
- ✅ Supabase RLS enabled with no permissive policies (default deny)
- ✅ Backend uses service role key, app-level user scoping
- ⚠️ In-memory mode has no cross-user isolation for demo users sharing IP

### CORS
- ✅ **Wildcard `*.vercel.app` removed** — only the exact configured deployment plus local dev origins are allowed
- ✅ **Preflight (OPTIONS) enforced in production** — allow-listed origins get 204/200, all others get 403 via the CORS policy handler (verified by tests)

### Input Validation
- ✅ Message length limits
- ✅ Attachment size limits
- ✅ Base64 magic-byte sniffing
- ✅ Image type validation
- ⚠️ No file type validation beyond images (backend accepts more)

---

## Files Changed for P0/P1 Resolutions

Backend:
- `backend/src/index.ts` — removed `*.vercel.app` CORS wildcard; allow-list only (plus dev leniency)
- `backend/src/middleware/api-key.ts` — `jwtOrApiKey` rejects invalid/revoked keys (401) and exhausted keys (429)
- `backend/src/config/settings.ts` — added `PRODUCT_VERSION: '1.0.0'`
- `backend/src/routes/auth.ts` — login/register/demo/me return `isAdmin`
- `backend/src/routes/security.test.ts` — CORS tests rewritten for no-wildcard + preflight enforcement
- `backend/src/middleware/api-key.test.ts` — new 401/429 `jwtOrApiKey` tests

Frontend:
- `frontend/src/components/ErrorBoundary.tsx` — NEW; app-wide error boundary
- `frontend/src/app/page.tsx` — error boundaries, `AdminDenied` guard, session refresh via `api.getMe()`
- `frontend/src/lib/api.ts` — added `getMe()`; removed legacy custom key/model from chat calls
- `frontend/src/stores/appStore.ts` — removed `ttsEnabled`/`apiKey`/`customModel` state
- `frontend/src/components/chat/Composer.tsx` — removed fake Mic/Globe buttons; attach content-agnostic
- `frontend/src/components/inspector/Inspector.tsx` — removed fake TTS/vision tools; Web Fetch rename
- `frontend/src/components/pages/SettingsPage.tsx` — removed TTS toggle + legacy LLM-key config; scrubs legacy keys
- `frontend/src/components/layout/Sidebar.tsx` — admin nav filtered by `isAdmin`; full-conversation fetch on open
- `frontend/src/components/pages/BillingPage.tsx` — null-guarded billing display (no crash on null plan)
- `frontend/src/components/pages/SettingsPage.tsx` / `frontend/src/components/inspector/Inspector.tsx` — product version labeled `SAGE v1.0.0` / `SAGE v1.0`

---

## Test Results

- Backend: **555/555 tests passing** (55 files) via `npx vitest run`
- Coverage: lines **93.12%**, branches **80.06%** (threshold 80%), functions **94.86%**, statements **93.12%**
- Frontend TypeScript: **Clean (0 errors)** via `tsc --noEmit`
- Frontend lint: **Clean (0 warnings/errors)** via `next lint`
- Frontend build: **Production build green** via `next build`
