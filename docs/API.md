# SAGE API Documentation

Base URL (local): `http://localhost:4000` · Production backend: `https://sage-backend.up.railway.app`

All endpoints return JSON. Errors use `{ "error": string }` and appropriate
HTTP status codes (400 malformed input, 401 unauthenticated, 403 forbidden,
404 not found, 413 oversized, 429 rate-limited / quota exceeded, 500 server).

---

## 1. Authentication

There are **two separate security domains** — do not confuse them:

| Domain | Issued by | Authenticates | Example |
|---|---|---|---|
| **Sage API keys** | SAGE (this platform) | Your integration calling SAGE's API | `sk_sage_...` |
| **Provider credentials** | Third parties (OpenAI, Anthropic, …) | SAGE calling the model provider on your behalf | `sk-...`, `gsk_...`, `AIza...` |

### JWT (user session, browser)

```
POST /api/auth/register   { "name", "email", "password" }
POST /api/auth/login      { "email", "password" }
```

Returns `{ token }`. Send it as `Authorization: Bearer <token>`.

### Sage API key (server-to-server)

```
Authorization: Bearer sk_sage_...
```

Keys are shown in plaintext **exactly once** at creation/rotation, are stored
as SHA-256 hashes, support scopes (`chat`, `conversations`, `admin`), optional
daily quotas, and expiration. Manage them in the **Settings → API Keys** UI or:

| Method | Endpoint | Notes |
|---|---|---|
| POST   | `/api/keys`              | Body: `{ name?, scopes?, quotaPerDay?, expiresAt? }` → returns plaintext once |
| GET    | `/api/keys`              | Masked list (id, suffix, scopes, usage, status, dates) |
| POST   | `/api/keys/:id/rotate`   | Revokes old key, returns new plaintext once |
| DELETE | `/api/keys/:id`          | Revoke |

Usage is metered per key (requests today) and capped by your plan tier.

---

## 2. Chat

```
POST /api/chat
Authorization: Bearer <JWT or sk_sage_...>   (optional for demo)
```

Body:

```jsonc
{
  "message": "Analyze this image",            // string, ≤ 50k chars
  "conversationId": "uuid",                   // optional — continues a session
  "providerId": "uuid",                       // optional — use your connected provider
  "attachments": {                            // optional
    "image_base64": "<base64>",               // ≤ 8 MB decoded
    "image_type": "png",                      // jpg | jpeg | png | webp | gif
    "image_name": "photo.png"                 // optional
  }
}
```

Response:

```jsonc
{
  "success": true,
  "agent": "VisionWorker",
  "intent": { "task": "ANALYZE", "confidence": 0.94, "has_attachments": true, "stages": [] },
  "response": { "content": "...", "source": { "provider": "openai", "model": "gpt-4o" } },
  "conversationId": "uuid"
}
```

- Images are validated by **magic bytes**, not just the claimed MIME type.
- If the selected model cannot process images, SAGE routes to a vision-capable
  model on the same credential (capability detection) or fails gracefully.
- Every turn is persisted to the conversation automatically (titles are
  generated intelligently; history is capped and sanitized).

`GET /api/chat/health` → engine health.

---

## 3. Provider credentials (BYO model providers)

Users connect their own provider API keys. Keys are **encrypted at rest with
AES-256-GCM** and are never returned, logged, or echoed in errors.

| Method | Endpoint | Notes |
|---|---|---|
| GET    | `/api/providers/catalog`    | Supported providers + default models |
| POST   | `/api/providers/connect`    | Body: `{ provider, apiKey, label?, baseUrl?, model?, supportsVision? }` |
| GET    | `/api/providers`            | List (masked: `sk-…abcd`) |
| GET    | `/api/providers/:id`        | Single credential (masked) |
| GET    | `/api/providers/:id/models` | Live model discovery from the provider |
| POST   | `/api/providers/:id/health` | Validate + refresh status |
| PATCH  | `/api/providers/:id`        | `{ model?, label?, supportsVision? }` — select model |
| DELETE | `/api/providers/:id`        | Revoke (destroys encrypted key) |

Supported providers: **OpenAI, Anthropic, Google Gemini, Groq, OpenRouter,
and any OpenAI-compatible API** (e.g. Ollama, LM Studio — pass `baseUrl`).

Responses are normalized into SAGE's unified schema, so the rest of the
pipeline is provider-agnostic. Chat requests can pin a provider with
`providerId`, or omit it to use the default (server Groq).

> **Production requirement:** set `SAGE_CREDENTIAL_ENCRYPTION_KEY` (base64 of
> a 32-byte key) in the backend environment. Without it, provider-credential
> features refuse to start in `NODE_ENV=production`. Generate one with:
> `openssl rand -base64 32`

---

## 4. Conversations (memory)

| Method | Endpoint | Notes |
|---|---|---|
| GET    | `/api/conversations`        | Your conversations (title, dates, message count) |
| POST   | `/api/conversations`        | Create `{ title? }` → returns `{ id }` |
| GET    | `/api/conversations/:id`    | Messages (restored in order) |
| DELETE | `/api/conversations/:id`    | Delete |
| POST   | `/api/conversations/:id/title` | `{ title }` — rename |

- Every conversation belongs to exactly one user; RLS + user-scoped queries
  prevent cross-user access.
- Chat auto-creates a conversation and generates a title from the first
  message. Titles and history are capped and sanitized.

---

## 5. Billing & organizations

| Method | Endpoint | Notes |
|---|---|---|
| GET    | `/api/billing/plans`        | Public plans catalog |
| GET    | `/api/billing/my-plan`      | Your plan + daily usage |
| POST   | `/api/billing/checkout`     | Checkout contract (payment-provider hook) |
| GET    | `/api/organizations`        | Your orgs |
| POST   | `/api/organizations`        | Create org |

Stripe (or any provider) is not required for SAGE to run; the billing layer
returns the exact contract a payment provider will fulfill. See
`backend/.env.example` for the provider env vars a human must supply.

---

## 6. Security guarantees

- **No plaintext credentials at rest** — provider keys are AES-256-GCM
  encrypted; Sage-issued keys are SHA-256 hashed.
- **No secret leakage** — keys never appear in logs, responses, or errors
  (`safeError` redacts `sk-…`, `gsk_…`, `xai-…`, `AIza…`).
- **User isolation** — every provider/API-key/conversation query is
  user-scoped; RLS policies in migrations `002`–`005` enforce it at the
  database layer.
- **Input limits** — chat message 50k chars, attachments 8 MB, provider
  connect fields bounded, oversized requests → 413.
- **Rate limits** — per-route auth rate limiting plus per-plan daily quotas.
- **Prompt injection** — history and attachments are sanitized, capped, and
  role-whitelisted before entering prompts.
