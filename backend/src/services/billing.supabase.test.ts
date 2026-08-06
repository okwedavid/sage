/**
 * services/billing.supabase.test.ts — Supabase-mode tests for the billing
 * service. Mocks the supabase module so getEffectivePlan/getUserUsage exercise
 * the DB-backed code paths (subscriptions + usage_events queries).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    tables: {} as Record<string, { data?: any; count?: number; error?: any }>,
  },
}));

vi.mock('../services/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({
    from: (table: string) => makeBuilder(table),
  }),
}));

import { getEffectivePlan, getUserUsage } from './billing';

function makeBuilder(table: string) {
  const cfg = mockDb.tables[table] || { data: null, error: null };
  const methods = ['select', 'eq', 'in', 'order', 'limit', 'gte', 'maybeSingle', 'single'];
  const builder: any = {};
  for (const m of methods) builder[m] = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.upsert = vi.fn(() => builder);
  // Awaiting the chain resolves to the configured outcome for that table.
  builder.then = (resolve: (v: any) => void) =>
    resolve(cfg.count !== undefined ? { count: cfg.count, error: cfg.error || null } : { data: cfg.data, error: cfg.error || null });
  return builder;
}

beforeEach(() => {
  mockDb.tables = {};
});

describe('getEffectivePlan (Supabase mode)', () => {
  it('resolves a Pro subscription from the subscriptions table', async () => {
    mockDb.tables['subscriptions'] = {
      data: { plan_id: 'pro', status: 'active', current_period_end: '2030-01-01T00:00:00Z' },
    };

    const { plan, status, currentPeriodEnd } = await getEffectivePlan('db-user');
    expect(plan.id).toBe('pro');
    expect(plan.dailyRequestLimit).toBe(500);
    expect(status).toBe('active');
    expect(currentPeriodEnd).toBe('2030-01-01T00:00:00Z');
  });

  it('falls back to Free when no live subscription row exists', async () => {
    mockDb.tables['subscriptions'] = { data: null };

    const { plan } = await getEffectivePlan('db-user-free');
    expect(plan.id).toBe('free');
  });

  it('falls back to Free for an unknown plan id', async () => {
    mockDb.tables['subscriptions'] = { data: { plan_id: 'legendary', status: 'active' } };

    const { plan } = await getEffectivePlan('db-user-legendary');
    expect(plan.id).toBe('free');
  });
});

describe('getUserUsage (Supabase mode)', () => {
  it('counts chat usage events in the trailing window', async () => {
    mockDb.tables['usage_events'] = { count: 7 };

    expect(await getUserUsage('db-user')).toBe(7);
  });
});
