# 💳 COMMERCIAL_READINESS — SAGE v1.1

**Date:** August 6, 2026 · **Branch:** `feature/v1.1-production-platform`

---

## 1. Readiness scores

| Dimension | Score | Rationale |
|-----------|:-----:|-----------|
| **Production Readiness** | **8.5 / 10** | 370 tests, 95% coverage gate, CI, security hardening, graceful degradation. Deductions: live deploy not yet updated; in-memory fallbacks in demo mode; uuid advisory tracked. |
| **Commercial Readiness** | **7.5 / 10** | Full billing-**ready** architecture (plans, subscriptions, invoices, quotas, metering, organizations, audit). Deductions: no live payment provider; no public signup/pricing page; Stripe not wired. |
| **Investor Readiness** | **8 / 10** | Polished UX, real platform architecture (plugins, memory, metrics, admin), roadmapped verticals. Deductions: AgentFinance not yet functional; deployment lag. |

## 2. What is production-ready today

- **Accounts & auth** — scrypt-hashed passwords, JWT sessions, rate-limited
  login/register, suspend/ban support, admin flag.
- **Multi-tenancy** — organizations with roles, invitations, per-plan caps.
- **API platform** — scoped, quota-metered API keys; usage events; audit logs.
- **Metering & quotas** — per-plan daily request limits enforced on chat,
  per-key quotas, org/key caps — server-side, cannot be bypassed client-side.
- **Observability** — structured logs, request IDs, per-endpoint and
  per-worker metrics, admin dashboard, health probes.
- **Billing data model** — `plans`, `subscriptions`, `invoices` with provider
  fields reserved (`stripe_customer_id`, `stripe_subscription_id`,
  `provider_invoice_id`).

## 3. Billing integration point (Stripe-ready)

The platform is designed so wiring a provider requires **no architecture
changes** — only a new module and env vars:

1. **Checkout** — replace the `501` stub in `POST /api/billing/checkout`
   (`routes/billing.ts`) with a Stripe Checkout Session creation call using
   `STRIPE_PRICE_PRO` / `STRIPE_PRICE_TEAM`, then `redirect(url)`.
2. **Webhook** — add `POST /api/billing/webhook`:
   - `checkout.session.completed` → upsert `subscriptions` row (plan_id,
     status `active`, period dates, `stripe_*` ids).
   - `invoice.paid` → insert `invoices` row.
   - `customer.subscription.updated/deleted` → update status
     (`past_due`, `canceled`, `cancel_at_period_end`).
   - Everything downstream (quotas, billing page, admin) picks it up with
     zero further changes.
3. **Portal** — replace the `501` stub in `POST /api/billing/portal` with a
   Stripe Billing Portal session.

Required env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM`. (Listed in the checkout 501 response.)

## 4. Revenue model (proposed)

| Plan | Price | Daily requests | Orgs | API keys | Notes |
|------|-------|---------------|------|----------|-------|
| Free | $0 | 20 | 1 | 3 | acquisition |
| Pro | $20/mo | 500 | 5 | 20 | individual builders |
| Team | $60/mo | 2,000 | 20 | 100 | teams + AgentFinance premium agent |

- **Premium verticals**: AgentFinance (and future plugins) gated behind
  Pro/Team via the existing `requires: ['billing']` mechanism.
- **BYOK note**: users may bring their own Groq key; server-side metering
  still applies to platform usage.

## 5. Remaining gaps to full commercial launch

1. **Payment provider** (Stripe) — §3. (Human + account setup.)
2. **Public pricing page** — the Billing page covers authenticated users; add
   a public `/pricing` variant for the landing site.
3. **Email infrastructure** — invite/verification emails (transactional
   email provider).
4. **Terms/privacy + legal review** — required before accepting real users.
5. **Rate-limit scale-out** — Redis-backed limits for multi-instance deploys.
6. **AgentFinance worker** — implement `createWorker` + data provider key.
7. **Deployment sync** — apply `DEPLOYMENT_REPORT.md` steps (Railway/Vercel).

## 6. Data model summary (migration 004)

- `organizations(id, name, slug UNIQUE, owner_id, metadata, timestamps)`
- `organization_members(organization_id, user_id, role, PK(org,user))`
- `plans(id PK, name, price_usd_cents, daily_request_limit,
  max_organizations, max_api_keys, features, active)`
- `subscriptions(id, user_id, plan_id FK, status, period dates,
  stripe_customer_id, stripe_subscription_id, UNIQUE active per user)`
- `invoices(id, subscription_id FK, user_id, amount_cents, status,
  provider_invoice_id)`

All tables RLS-enabled with default-deny (service-key access), consistent with
migrations 001–003.
