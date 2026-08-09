# SAGE v1.3 — Release Notes

**Milestone:** v1.3 Monetization + Account Security · **Branch:** `feature/v1.1-production-platform`
**Date:** August 9, 2026 · **Engine version:** SAGE v7.1

---

## 🎯 What this release delivers

SAGE can now **charge customers and recover accounts**. The billing layer
moves from a documented contract to **live Stripe** (checkout, billing portal,
signature-verified webhooks with idempotent subscription/invoice processing),
and users get a **full password-reset flow** delivered by **Resend** email —
with the entire flow hardening frontend + backend. Provider credentials also
gain **atomic key rotation**: a new key is validated against the live provider
before it replaces the old one, so a bad key can never clobber a working one.

**Quality gate:** 550 backend tests (55 files) · typecheck (app + tests) +
lint clean · frontend production build + lint clean.

---

## ✨ New in v1.3

### Password Reset (account recovery)
- `POST /api/auth/forgot-password` — request a reset link. **Uniform response
  whether or not the account exists** (no user enumeration); rate-limited per IP.
- `POST /api/auth/reset-password` — redeem a token for a new password.
- **Security-first tokens** — 32-byte random values, only SHA-256 hashes
  persisted, single-use with a 1-hour TTL, and all outstanding tokens revoked
  after success.
- **Resend email delivery** (`RESEND_API_KEY`) with an on-brand HTML template.
  In non-production without SMTP, the link is returned as `devResetUrl` so
  local flows still work; production never returns the link in an API response.
- Frontend auth modal gains **Forgot password? / Set new password** views and
  deep-links straight into the reset form via `?reset_token=…` (token is
  stripped from the URL history after capture).

### Stripe Billing (live)
- **Checkout** — real Stripe Checkout sessions against recurring `pro`/`team`
  prices (`STRIPE_PRICE_PRO` / `STRIPE_PRICE_TEAM`), subscription mode, user
  metadata carried through to webhooks.
- **Billing portal** — `POST /api/billing/portal` opens the Stripe customer
  portal for plan changes / payment methods / cancellation.
- **Webhook** — `POST /api/billing/webhook` verifies signatures against the
  raw payload (`constructEvent`; invalid → 400). Handles
  `checkout.session.completed`, `customer.subscription.updated/deleted`, and
  invoice paid/failed events — idempotent via the `stripe_events` table
  (migration `006`), so Stripe retries are always safe.
- **Graceful degradation** — until the four Stripe env vars are set, the
  checkout/portal endpoints return the documented `payment_provider_not_configured`
  contract and webhooks answer 501. Nothing breaks, nothing leaks.

### Provider Key Rotation
- `POST /api/providers/:id/rotate` — the new key is **live-validated against
  the provider before it replaces the old one**. Bad keys are rejected and the
  working credential stays intact. Settings → Providers UI updated.

### Chat hardening
- Attachments must be an object; `image_type` restricted to
  jpg/jpeg/png/webp/gif; `image_name` length-bounded; history over 40 turns is
  capped to the last 40.

---

## 🗄️ Migration

Apply `006_password_reset_stripe.sql` to the production Supabase project
(after 001–005). It adds:

- `password_resets` — hashed one-time tokens with expiry and consumption.
- `stripe_events` — webhook idempotency ledger (PK = Stripe event id).

## 🚀 Deployment notes

- Set **`RESEND_API_KEY`** (required in production for reset emails),
  optionally `EMAIL_FROM` and `PASSWORD_RESET_TTL_MS`.
- Set **`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_PRO` /
  `STRIPE_PRICE_TEAM`** (test-mode keys work out of the box) to activate
  billing. Register the webhook endpoint in Stripe for
  `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
- `STRIPE_WEBHOOK_SECRET` is the `whsec_…` from the Stripe webhook dashboard,
  not the secret key.

## 🧭 Recommended next steps

1. Create the PR to `main` (human approval) and merge.
2. Apply migrations 001–006 and set Resend + Stripe env vars in production.
3. Switch Stripe from test to live keys and set live price IDs.
4. Implement the AgentFinance worker (finance data provider + premium gate).

---

_Built with ❤️ by the SAGE team — Think. Understand. Act. Evolve._
