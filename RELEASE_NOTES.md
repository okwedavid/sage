# SAGE v1.2 — Release Notes

**Milestone:** v1.2 BYO Providers + Memory + Security · **Branch:** `feature/v1.1-production-platform`
**Date:** August 8, 2026 · **Engine version:** SAGE v7.1

---

## 🎯 What this release delivers

SAGE becomes **provider-agnostic and self-serve**: users connect their own AI
credentials (OpenAI, Anthropic, Gemini, Groq, OpenRouter, or any
OpenAI-compatible endpoint), images "just work", greetings no longer get
rejected by the classifier, every conversation is remembered and resumable,
and the settings surface now manages both Sage-issued API keys and provider
credentials — with strong encryption and isolation guarantees throughout.

**Quality gate:** 479 backend tests · 92.5% statements / 80.5% branches /
94.25% functions coverage (thresholds enforced in CI) · frontend builds clean.

---

## ✨ New in v1.2

### Natural Conversation
- **CHAT intent** — greetings and small talk are classified conversationally
  by a deterministic detector instead of being rejected by the research
  confidence gate. Ambiguity gating for real tasks is unchanged.

### BYO Provider System
- **Connect your own keys** — one encrypted credential store for OpenAI,
  Anthropic, Gemini, Groq, OpenRouter, and OpenAI-compatible APIs (custom
  `baseUrl` for Ollama/LM Studio, etc.).
- **AES-256-GCM at rest** — keys never appear in logs, responses, errors, or
  DB queries returned to clients. `SAGE_CREDENTIAL_ENCRYPTION_KEY` required in
  production.
- **Full lifecycle** — live validation on connect, model discovery, health
  checks, per-credential model selection, and revocation.
- **Unified schema** — every provider response is normalized by the
  `ChatGateway` into SAGE's internal schema; adding a provider is one adapter,
  not a pipeline change.

### Image Analysis (fixed)
- Attachments are validated by **magic bytes**, not claimed MIME types.
- JPEG / PNG / WEBP / GIF supported where the model can handle them.
- **Vision capability detection** — if the selected model can't see images,
  SAGE routes to a vision-capable model on the same credential; text-only
  models fail gracefully instead of fabricating analysis.

### Conversation Memory (completed)
- Every chat turn persists automatically with a **generated title**, message
  caps, and sanitized history.
- Sidebar lists recent sessions; reopen any conversation and continue where
  you stopped; start a fresh one anytime. Rename via the new title endpoint.

### Settings
- **API Keys** — create (plaintext exactly once), masked list, copy, rotate,
  revoke, with created/status/usage metadata. `sk_sage_…` keys are SHA-256
  hashed at rest — a separate security domain from provider keys.
- **Providers** — connect/list/models/health/select/revoke, plus the live
  catalog, all in the existing design system.

### Billing & polish
- **Subscription entry point** next to the profile avatar (links to the
  existing billing page; payment-provider wiring remains the documented
  human step).
- **SAGE loading indicator** — the branded loader appears where the response
  body will render and clears on completion or error.

### Documentation
- New `docs/API.md` (auth, chat, providers, conversations, billing, security
  guarantees); README endpoints/env/architecture updated.

---

## 📦 What was verified

- Backend: **479 tests across 49 files** — all passing; coverage thresholds met.
- TypeScript typechecks (app + tests) clean; ESLint clean (backend + frontend).
- Frontend production build succeeds (Next.js 14).

## 🚀 Deployment notes

- Apply migration `005_provider_credentials.sql` (and 001–004 if not yet
  applied) to the production Supabase project.
- Set `SAGE_CREDENTIAL_ENCRYPTION_KEY` (base64 of a 32-byte key,
  `openssl rand -base64 32`) on the Railway backend before enabling provider
  credentials.
- Deploying still requires Railway/Vercel credentials — see
  `DEPLOYMENT_REPORT.md`.

## 🧭 Recommended next steps

1. Create the PR to `main` (human approval) and merge.
2. Apply migrations 001–005 and set the encryption key in production.
3. Wire a payment provider (Stripe) using the checkout/webhook contract.
4. Publish the provider catalog to more OpenAI-compatible hosts.

---

_Built with ❤️ by the SAGE team — Think. Understand. Act. Evolve._
