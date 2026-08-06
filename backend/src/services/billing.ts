/**
 * services/billing.ts
 * OWNS: Subscription plans, effective-plan resolution, and usage quotas.
 *
 * Billing-READY architecture: the plan catalog and quota enforcement are fully
 * implemented. The payment-provider integration point (checkout / webhooks)
 * is deliberately external — see `routes/billing.ts` and
 * COMMERCIAL_READINESS.md. Once Stripe (or another provider) is wired, its
 * webhook simply creates/updates rows in the `subscriptions` + `invoices`
 * tables and everything downstream (quotas, admin dashboard, billing page)
 * starts reflecting it with zero further changes.
 *
 * Persistence: Supabase when configured; otherwise an in-memory fallback so
 * the platform still works for local/demo runs (users get the Free plan).
 */
import { isSupabaseConfigured, getSupabase } from './supabase';

export type PlanId = 'free' | 'pro' | 'team';

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  priceUsdCents: number;
  currency: string;
  billingInterval: 'month' | 'year';
  /** Daily chat request limit. 0 = unlimited. */
  dailyRequestLimit: number;
  maxOrganizations: number;
  maxApiKeys: number;
  features: string[];
}

/** Static catalog — the source of truth. Mirrors the seeded `plans` table. */
export const PLAN_CATALOG: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'For personal exploration',
    priceUsdCents: 0,
    currency: 'usd',
    billingInterval: 'month',
    dailyRequestLimit: 20,
    maxOrganizations: 1,
    maxApiKeys: 3,
    features: [
      'Chat with SAGE (20 requests/day)',
      'Conversation memory',
      '1 organization',
      '3 API keys',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For power users and builders',
    priceUsdCents: 2000,
    currency: 'usd',
    billingInterval: 'month',
    dailyRequestLimit: 500,
    maxOrganizations: 5,
    maxApiKeys: 20,
    features: [
      '500 requests/day',
      'Priority inference',
      '5 organizations',
      '20 API keys',
      'Full API access',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    description: 'For teams shipping with SAGE',
    priceUsdCents: 6000,
    currency: 'usd',
    billingInterval: 'month',
    dailyRequestLimit: 2000,
    maxOrganizations: 20,
    maxApiKeys: 100,
    features: [
      '2000 requests/day',
      'Priority inference',
      '20 organizations',
      '100 API keys',
      'Dedicated support',
    ],
  },
];

export const DEFAULT_PLAN_ID: PlanId = 'free';

export function getPlan(planId: string): Plan | null {
  return PLAN_CATALOG.find((p) => p.id === planId) || null;
}

export function listPlans(): Plan[] {
  return [...PLAN_CATALOG].sort((a, b) => a.priceUsdCents - b.priceUsdCents);
}

// ── In-memory fallback state (only when Supabase is not configured) ──────────
// Tracks per-user daily request counts so the Free-tier quota still applies in
// demo mode. Rollover happens on the first request of a new UTC day.
const memDailyUsage = new Map<string, { day: string; count: number }>();
const memSubscriptions = new Map<string, { planId: PlanId; status: string; periodEnd: string }>();

function utcDayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/**
 * Resolve the effective plan for a user. Reads the live subscription from
 * Supabase when configured; otherwise the in-memory fallback (always Free in
 * demo mode until a payment provider is wired).
 */
export async function getEffectivePlan(userId: string): Promise<{
  plan: Plan;
  status: string;
  currentPeriodEnd: string | null;
}> {
  if (isSupabaseConfigured()) {
    const db = getSupabase();
    if (db) {
      const { data, error } = await db
        .from('subscriptions')
        .select('plan_id, status, current_period_end')
        .eq('user_id', userId)
        .in('status', ['active', 'trialing'])
        .order('current_period_end', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fail-open but observed: a DB error must never silently downgrade a
      // paying user to the Free tier, nor should it go unlogged in a metered
      // product. Alert on this in production monitoring.
      if (error) {
        console.error('[billing] getEffectivePlan query failed:', error.message);
      }

      if (data?.plan_id) {
        const plan = getPlan(data.plan_id) || getPlan(DEFAULT_PLAN_ID)!;
        return {
          plan,
          status: data.status || 'active',
          currentPeriodEnd: data.current_period_end || null,
        };
      }
    }
  }

  const sub = memSubscriptions.get(userId);
  if (sub) {
    const plan = getPlan(sub.planId) || getPlan(DEFAULT_PLAN_ID)!;
    return { plan, status: sub.status, currentPeriodEnd: sub.periodEnd };
  }

  return { plan: getPlan(DEFAULT_PLAN_ID)!, status: 'active', currentPeriodEnd: null };
}

/**
 * Count a user's chat requests in the trailing window (default 24h).
 * Supabase mode counts `usage_events` rows (cross-instance, source of truth).
 * Demo mode uses a per-process rolling counter.
 */
export async function getUserUsage(userId: string, windowMs = 24 * 3600 * 1000): Promise<number> {
  if (isSupabaseConfigured()) {
    const db = getSupabase();
    if (db) {
      const since = new Date(Date.now() - windowMs).toISOString();
      const { count, error } = await db
        .from('usage_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('endpoint', '/api/chat')
        .gte('created_at', since);
      if (!error) return count || 0;
      // Fail-open but observed: an undercount here would under-meter usage.
      console.error('[billing] getUserUsage query failed:', error.message);
    }
  }

  const entry = memDailyUsage.get(userId);
  if (!entry || entry.day !== utcDayKey(Date.now())) return 0;
  return entry.count;
}

/** Record a chat request against the user's quota (demo-mode counter only). */
export function recordChatUsage(userId: string): void {
  if (isSupabaseConfigured()) return; // Supabase mode is counted from usage_events
  const day = utcDayKey(Date.now());
  const entry = memDailyUsage.get(userId);
  if (entry && entry.day === day) {
    entry.count += 1;
  } else {
    memDailyUsage.set(userId, { day, count: 1 });
  }
}

export interface QuotaStatus {
  ok: boolean;
  planId: PlanId;
  limit: number;
  used: number;
  remaining: number;
}

/**
 * Enforce the user's daily chat quota. `ok: false` means the request must be
 * rejected (HTTP 429). `limit: 0` means unlimited.
 */
export async function enforceChatQuota(userId: string): Promise<QuotaStatus> {
  const { plan } = await getEffectivePlan(userId);
  const used = await getUserUsage(userId);

  if (plan.dailyRequestLimit === 0) {
    // -1 is the JSON-safe "unlimited" sentinel (Infinity serializes to null).
    return { ok: true, planId: plan.id, limit: 0, used, remaining: -1 };
  }

  // Allow exactly `limit` requests per day (used is counted after recording).
  return {
    ok: used < plan.dailyRequestLimit,
    planId: plan.id,
    limit: plan.dailyRequestLimit,
    used,
    remaining: Math.max(0, plan.dailyRequestLimit - used),
  };
}

// ── Test/demo hook: assign a subscription without a payment provider ────────
// Used by integration tests and demo scripts. In production, subscriptions are
// created by the payment-provider webhook.
export function setSubscriptionForTesting(
  userId: string,
  planId: PlanId,
  opts?: { status?: string; periodEnd?: string }
): void {
  memSubscriptions.set(userId, {
    planId,
    status: opts?.status || 'active',
    periodEnd: opts?.periodEnd || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  });
}
