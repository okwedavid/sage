/**
 * services/supabase-persistence.test.ts — Supabase-mode tests for the
 * persistence functions added for password reset + Stripe idempotency.
 * Mocks @supabase/supabase-js so the DB-backed code paths run deterministically.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    responses: {} as Record<string, any>,
    ops: [] as any[],
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const chain: any = {};
      const track = (op: string, args?: any) => {
        mockClient.ops.push({ table, op, args });
        return chain;
      };
      ['select', 'eq', 'is', 'gt', 'not', 'order', 'limit', 'maybeSingle', 'single', 'in', 'gte']
        .forEach((m) => {
          chain[m] = (...args: any[]) => track(m, args);
        });
      chain.insert = (...args: any[]) => track('insert', args);
      chain.update = (...args: any[]) => track('update', args);
      chain.delete = (...args: any[]) => track('delete', args);
      chain.then = (resolve: (v: any) => void) =>
        resolve(mockClient.responses[table] || { data: null, error: null });
      return chain;
    },
  }),
}));

vi.hoisted(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'service-key-test';
  process.env.GROQ_API_KEY = 'gsk_test';
});

import {
  updateUserPassword,
  createPasswordReset,
  findActivePasswordReset,
  consumePasswordReset,
  revokePasswordResets,
  hasStripeEvent,
  recordStripeEvent,
  getStripeCustomerId,
} from './supabase';

beforeEach(() => {
  mockClient.responses = {};
  mockClient.ops = [];
});

describe('updateUserPassword', () => {
  it('updates the password hash for a user', async () => {
    mockClient.responses['users'] = { data: { id: 'u1' }, error: null };
    expect(await updateUserPassword('u1', 'scrypt:newhash')).toBe(true);
    const update = mockClient.ops.find((o: any) => o.op === 'update' && o.table === 'users');
    expect(update.args[0]).toMatchObject({ password_hash: 'scrypt:newhash' });
    expect(update.args[0].updated_at).toBeTruthy();
  });

  it('returns false on a DB error', async () => {
    mockClient.responses['users'] = { data: null, error: { message: 'db down' } };
    expect(await updateUserPassword('u1', 'x')).toBe(false);
  });
});

describe('password reset persistence', () => {
  it('creates a reset row with only the token hash', async () => {
    mockClient.responses['password_resets'] = {
      data: { id: 'r1', user_id: 'u1', token_hash: 'abc', expires_at: 't', used_at: null },
      error: null,
    };
    const row = await createPasswordReset({ userId: 'u1', tokenHash: 'abc', expiresAt: 't' });
    expect(row?.id).toBe('r1');
    const insert = mockClient.ops.find((o: any) => o.op === 'insert' && o.table === 'password_resets');
    expect(insert.args[0]).toMatchObject({ user_id: 'u1', token_hash: 'abc', expires_at: 't' });
  });

  it('returns null when creation fails', async () => {
    mockClient.responses['password_resets'] = { data: null, error: { message: 'failed' } };
    expect(await createPasswordReset({ userId: 'u1', tokenHash: 'a', expiresAt: 't' })).toBeNull();
  });

  it('finds only unused, unexpired resets', async () => {
    mockClient.responses['password_resets'] = {
      data: { id: 'r1', user_id: 'u1', token_hash: 'abc', expires_at: 't' },
      error: null,
    };
    const row = await findActivePasswordReset('abc');
    expect(row?.id).toBe('r1');
    expect(mockClient.ops.some((o: any) => o.op === 'eq' && o.args[0] === 'token_hash' && o.args[1] === 'abc')).toBe(true);
    // Unused-only filter is expressed as is(used_at, null)
    expect(mockClient.ops.some((o: any) => o.op === 'is' && o.args[0] === 'used_at' && o.args[1] === null)).toBe(true);
    // Unexpired-only filter is expressed as gt(expires_at, now)
    expect(mockClient.ops.some((o: any) => o.op === 'gt' && o.args[0] === 'expires_at')).toBe(true);
  });

  it('returns null when no active reset matches', async () => {
    mockClient.responses['password_resets'] = { data: null, error: null };
    expect(await findActivePasswordReset('nope')).toBeNull();
  });

  it('consumes a reset (single-use) and revokes outstanding ones', async () => {
    mockClient.responses['password_resets'] = { data: null, error: null };
    expect(await consumePasswordReset('r1')).toBe(true);
    expect(mockClient.ops.some((o: any) => o.op === 'update' && o.table === 'password_resets')).toBe(true);

    await revokePasswordResets('u1');
    expect(mockClient.ops.some((o: any) => o.op === 'delete' && o.table === 'password_resets')).toBe(true);
    // The ownership scoping on the delete: eq(user_id, u1)
    expect(
      mockClient.ops.some((o: any) => o.op === 'eq' && o.table === 'password_resets' && o.args[0] === 'user_id' && o.args[1] === 'u1')
    ).toBe(true);
  });
});

describe('stripe event idempotency', () => {
  it('reports whether an event id was already processed', async () => {
    mockClient.responses['stripe_events'] = { data: { id: 'evt_1' }, error: null };
    expect(await hasStripeEvent('evt_1')).toBe(true);

    mockClient.responses['stripe_events'] = { data: null, error: null };
    expect(await hasStripeEvent('evt_2')).toBe(false);
  });

  it('records processed events and tolerates unique-constraint races', async () => {
    mockClient.responses['stripe_events'] = { data: null, error: null };
    await recordStripeEvent('evt_1', 'checkout.session.completed');
    expect(mockClient.ops.some((o: any) => o.op === 'insert' && o.table === 'stripe_events')).toBe(true);

    // A concurrent retry hitting the unique constraint is not an error.
    mockClient.responses['stripe_events'] = { data: null, error: { code: '23505', message: 'duplicate' } };
    await expect(recordStripeEvent('evt_1', 'checkout.session.completed')).resolves.toBeUndefined();
  });
});

describe('getStripeCustomerId', () => {
  it('returns the latest customer id for the user', async () => {
    mockClient.responses['subscriptions'] = { data: { stripe_customer_id: 'cus_test_1' }, error: null };
    expect(await getStripeCustomerId('u1')).toBe('cus_test_1');
  });

  it('returns null when none exists', async () => {
    mockClient.responses['subscriptions'] = { data: null, error: null };
    expect(await getStripeCustomerId('u1')).toBeNull();
  });
});
