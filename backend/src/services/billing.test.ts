/**
 * services/billing.test.ts — Unit tests for the billing service (demo mode:
 * Supabase unconfigured → in-memory fallback, Free plan default).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  PLAN_CATALOG,
  getPlan,
  listPlans,
  getEffectivePlan,
  getUserUsage,
  recordChatUsage,
  enforceChatQuota,
  setSubscriptionForTesting,
} from './billing';

describe('plan catalog', () => {
  it('defines free, pro, and team plans in ascending price order', () => {
    expect(PLAN_CATALOG.map((p) => p.id)).toEqual(['free', 'pro', 'team']);
    expect(PLAN_CATALOG[0].priceUsdCents).toBe(0);
    expect(PLAN_CATALOG[1].priceUsdCents).toBe(2000);
    expect(PLAN_CATALOG[2].priceUsdCents).toBe(6000);
  });

  it('resolves plans by id and rejects unknown ids', () => {
    expect(getPlan('free')?.name).toBe('Free');
    expect(getPlan('pro')?.dailyRequestLimit).toBe(500);
    expect(getPlan('nope')).toBeNull();
  });

  it('lists plans sorted by price', () => {
    const plans = listPlans();
    expect(plans[0].id).toBe('free');
    expect(plans[2].id).toBe('team');
  });
});

describe('effective plan', () => {
  it('defaults to the Free plan without a subscription', async () => {
    const { plan, status } = await getEffectivePlan('user-no-sub');
    expect(plan.id).toBe('free');
    expect(status).toBe('active');
  });

  it('honors a testing-assigned subscription', async () => {
    setSubscriptionForTesting('user-pro', 'pro');
    const { plan, status } = await getEffectivePlan('user-pro');
    expect(plan.id).toBe('pro');
    expect(plan.dailyRequestLimit).toBe(500);
    expect(status).toBe('active');
  });
});

describe('quota enforcement (Free = 20/day)', () => {
  beforeEach(() => {
    // Fresh quota per user id; nothing to reset globally.
  });

  it('starts at 0 usage and allows requests under the limit', async () => {
    const id = 'quota-fresh';
    expect(await getUserUsage(id)).toBe(0);
    const quota = await enforceChatQuota(id);
    expect(quota.ok).toBe(true);
    expect(quota.limit).toBe(20);
    expect(quota.used).toBe(0);
  });

  it('counts recorded chat usage', async () => {
    const id = 'quota-counter';
    recordChatUsage(id);
    recordChatUsage(id);
    expect(await getUserUsage(id)).toBe(2);
  });

  it('allows exactly 20 requests then blocks the 21st on the Free tier', async () => {
    const id = 'quota-limit';
    // Quota is checked BEFORE each request is recorded, so after 19 recorded
    // requests the 20th is still allowed.
    for (let i = 0; i < 19; i++) recordChatUsage(id);
    expect((await enforceChatQuota(id)).ok).toBe(true);

    recordChatUsage(id); // the 20th request lands
    expect(await getUserUsage(id)).toBe(20);

    const over = await enforceChatQuota(id); // the 21st request
    expect(over.ok).toBe(false);
    expect(over.planId).toBe('free');
    expect(over.remaining).toBe(0);
  });

  it('raises the ceiling for Pro subscribers', async () => {
    const id = 'quota-pro';
    setSubscriptionForTesting(id, 'pro');
    const quota = await enforceChatQuota(id);
    expect(quota.ok).toBe(true);
    expect(quota.limit).toBe(500);
  });
});
