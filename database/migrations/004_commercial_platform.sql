-- ============================================================================
-- SAGE Migration 004 — Commercial Platform
-- Organizations, memberships, subscription plans, subscriptions, invoices.
-- Billing-READY: payment-provider fields (stripe_customer_id etc.) are present
-- but NULL until a payment provider is wired (see COMMERCIAL_READINESS.md).
-- Idempotent.
--
-- REQUIRES migration 001 first: the timestamp triggers below call
-- update_updated_at(), which migration 001 defines.
-- ============================================================================

-- ── organizations ───────────────────────────────────────────────────────────
-- Multi-tenant workspaces. A user may belong to many organizations; the first
-- organization a user creates becomes their personal workspace.
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL,               -- JWT userId (no FK — JWT-only users)
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);

-- ── organization_members ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_members (
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,                -- JWT userId (no FK — see migration 001)
  role TEXT NOT NULL DEFAULT 'member',  -- owner | admin | member
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);

-- ── plans ───────────────────────────────────────────────────────────────────
-- Static catalog of sellable subscription plans. Seeded below; extend via
-- INSERT (not ALTER) when new tiers ship.
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,                  -- 'free' | 'pro' | 'team'
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_usd_cents INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  billing_interval TEXT NOT NULL DEFAULT 'month',  -- month | year
  daily_request_limit INT NOT NULL DEFAULT 0,      -- 0 = unlimited
  max_organizations INT NOT NULL DEFAULT 1,
  max_api_keys INT NOT NULL DEFAULT 5,
  features JSONB DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── subscriptions ───────────────────────────────────────────────────────────
-- One active subscription per user (unique partial index on active status).
-- Provider fields (stripe_customer_id / stripe_subscription_id) are reserved
-- for the future payment provider integration.
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'active',     -- active | trialing | past_due | canceled
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 month',
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_id);
-- Only one *live* subscription per user at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_user_active
  ON subscriptions(user_id) WHERE status IN ('active', 'trialing');

-- ── invoices ────────────────────────────────────────────────────────────────
-- Payment history. Populated by the payment provider webhook once wired.
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  amount_cents INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | paid | failed | refunded
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  provider_invoice_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);

-- ── Seed plans ──────────────────────────────────────────────────────────────
INSERT INTO plans (id, name, description, price_usd_cents, daily_request_limit,
                   max_organizations, max_api_keys, features, sort_order)
VALUES
  ('free', 'Free', 'For personal exploration', 0, 20, 1, 3,
   '["Chat with SAGE (20 requests/day)", "Conversation memory", "1 organization", "3 API keys"]', 0),
  ('pro', 'Pro', 'For power users and builders', 2000, 500, 5, 20,
   '["500 requests/day", "Priority inference", "5 organizations", "20 API keys", "Full API access"]', 1),
  ('team', 'Team', 'For teams shipping with SAGE', 6000, 2000, 20, 100,
   '["2000 requests/day", "Priority inference", "20 organizations", "100 API keys", "Dedicated support"]', 2)
ON CONFLICT (id) DO NOTHING;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Service-key only access (default deny). The backend never uses the anon key
-- for these tables. When Supabase Auth is adopted, add owner/member policies.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- ── Timestamp triggers ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS organizations_updated ON organizations;
CREATE TRIGGER organizations_updated
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS subscriptions_updated ON subscriptions;
CREATE TRIGGER subscriptions_updated
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
