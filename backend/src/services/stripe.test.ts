/**
 * services/stripe.test.ts — Unit tests for the Stripe integration.
 *
 * The `stripe` SDK and the `../services/supabase` persistence layer are mocked
 * so checkout creation, signature verification, and webhook event processing
 * (including idempotency) run deterministically in TEST MODE.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockStripe, mockDb } = vi.hoisted(() => {
  const mockStripe = {
    constructEvent: vi.fn(),
    createSession: vi.fn(),
    retrieveSubscription: vi.fn(),
    portalSession: vi.fn(),
  };
  const mockDb = {
    events: new Set<string>(),
    customerId: null as string | null,
    existingLiveSubscription: null as any,
    responses: {} as Record<string, any>,
    throwOnInsert: false,
    writes: [] as any[],
  };
  return { mockStripe, mockDb };
});

vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy';
  process.env.STRIPE_PRICE_PRO = 'price_pro_test';
  process.env.STRIPE_PRICE_TEAM = 'price_team_test';
});

vi.mock('stripe', () => ({
  default: class MockStripe {
    checkout = { sessions: { create: mockStripe.createSession } };
    billingPortal = { sessions: { create: mockStripe.portalSession } };
    webhooks = { constructEvent: mockStripe.constructEvent };
    subscriptions = { retrieve: mockStripe.retrieveSubscription };
  },
}));

vi.mock('../services/supabase', () => {
  function makeBuilder(table: string) {
    const cfg = mockDb as any;
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      maybeSingle: vi.fn(() => chain),
      single: vi.fn(() => chain),
      not: vi.fn(() => chain),
      update: vi.fn((payload: any) => {
        cfg.writes.push({ op: 'update', table, payload });
        return chain;
      }),
      insert: vi.fn((payload: any) => {
        if (cfg.throwOnInsert) throw new Error('boom');
        cfg.writes.push({ op: 'insert', table, payload });
        return chain;
      }),
      delete: vi.fn(() => chain),
    };
    // Awaiting the chain resolves per-table fixtures.
    chain.then = (resolve: (v: any) => void) => {
      const custom = cfg.responses?.[table];
      if (custom !== undefined) {
        resolve(custom);
        return;
      }
      if (table === 'subscriptions' && cfg.existingLiveSubscription) {
        resolve({ data: cfg.existingLiveSubscription, error: null });
      } else {
        resolve({ data: null, error: null });
      }
    };
    return chain;
  }

  return {
    getSupabase: () => ({ from: (table: string) => makeBuilder(table) }),
    hasStripeEvent: async (id: string) => mockDb.events.has(id),
    recordStripeEvent: async (id: string) => {
      mockDb.events.add(id);
    },
    getStripeCustomerId: async () => mockDb.customerId,
    recordAudit: async () => {},
  };
});

import {
  isStripeConfigured,
  createCheckoutSession,
  createPortalSession,
  verifyWebhook,
  processStripeEvent,
} from './stripe';

beforeEach(() => {
  mockDb.events.clear();
  mockDb.customerId = null;
  mockDb.existingLiveSubscription = null;
  mockDb.responses = {};
  mockDb.throwOnInsert = false;
  mockDb.writes = [];
  vi.clearAllMocks();
});

describe('isStripeConfigured', () => {
  it('is true when all Stripe env vars are present (test mode)', () => {
    expect(isStripeConfigured()).toBe(true);
  });
});

describe('createCheckoutSession', () => {
  it('creates a subscription checkout session with metadata', async () => {
    mockStripe.createSession.mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' });

    const result = await createCheckoutSession('user-123', 'pro', 'pro@user.dev');

    expect(result.url).toContain('checkout.stripe.com');
    expect(result.sessionId).toBe('cs_test_1');
    const call = mockStripe.createSession.mock.calls[0][0];
    expect(call.mode).toBe('subscription');
    expect(call.line_items).toEqual([{ price: 'price_pro_test', quantity: 1 }]);
    expect(call.customer_email).toBe('pro@user.dev');
    expect(call.client_reference_id).toBe('user-123');
    expect(call.metadata).toMatchObject({ userId: 'user-123', planId: 'pro' });
    expect(call.success_url).toContain('checkout=success');
  });

  it('throws when no price is configured for the plan', async () => {
    await expect(createCheckoutSession('u1', 'free')).rejects.toThrow('No Stripe price configured');
  });
});

describe('createPortalSession', () => {
  it('opens the billing portal for a known customer', async () => {
    mockDb.customerId = 'cus_test_1';
    mockStripe.portalSession.mockResolvedValue({ url: 'https://billing.stripe.com/p/session/xyz' });

    const result = await createPortalSession('user-123');
    expect(result.url).toContain('billing.stripe.com');
    expect(mockStripe.portalSession.mock.calls[0][0].customer).toBe('cus_test_1');
  });

  it('throws when the user has no Stripe customer id', async () => {
    await expect(createPortalSession('user-unknown')).rejects.toThrow('No Stripe customer');
  });
});

describe('verifyWebhook', () => {
  it('accepts a valid signature via constructEvent', () => {
    const event = { id: 'evt_valid', type: 'checkout.session.completed' };
    mockStripe.constructEvent.mockReturnValue(event);

    expect(verifyWebhook(Buffer.from('{}'), 't=1,v1=deadbeef')).toBe(event);
    expect(mockStripe.constructEvent).toHaveBeenCalledWith(
      Buffer.from('{}'),
      't=1,v1=deadbeef',
      'whsec_test_dummy'
    );
  });

  it('throws on an invalid signature', () => {
    mockStripe.constructEvent.mockImplementation(() => {
      throw new Error('No signatures found');
    });
    expect(() => verifyWebhook(Buffer.from('{}'), 't=1,v1=bad')).toThrow();
  });
});

describe('processStripeEvent', () => {
  it('activates a subscription on checkout.session.completed', async () => {
    mockStripe.retrieveSubscription.mockResolvedValue({
      id: 'sub_test_1',
      status: 'active',
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      customer: 'cus_test_1',
    });

    const result = await processStripeEvent({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          client_reference_id: 'user-123',
          customer: 'cus_test_1',
          subscription: 'sub_test_1',
          metadata: { userId: 'user-123', planId: 'pro' },
        },
      },
    } as any);

    expect(result).toEqual({ handled: true, duplicate: false });
    const write = mockDb.writes.find((w: any) => w.op === 'insert' && w.table === 'subscriptions');
    expect(write).toBeDefined();
    expect(write.payload).toMatchObject({
      user_id: 'user-123',
      plan_id: 'pro',
      status: 'active',
      stripe_customer_id: 'cus_test_1',
      stripe_subscription_id: 'sub_test_1',
    });
    expect(mockDb.events.has('evt_1')).toBe(true);
  });

  it('updates an existing live subscription instead of inserting a duplicate', async () => {
    mockDb.existingLiveSubscription = { id: 'sub_row_existing' };
    mockStripe.retrieveSubscription.mockResolvedValue({
      id: 'sub_test_2',
      status: 'trialing',
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      customer: 'cus_test_1',
    });

    await processStripeEvent({
      id: 'evt_2',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_2',
          client_reference_id: 'user-456',
          customer: 'cus_test_1',
          subscription: 'sub_test_2',
          metadata: { userId: 'user-456', planId: 'team' },
        },
      },
    } as any);

    const updates = mockDb.writes.filter((w: any) => w.op === 'update' && w.table === 'subscriptions');
    expect(updates.length).toBeGreaterThan(0);
    expect(updates[0].payload).toMatchObject({ plan_id: 'team', status: 'trialing' });
  });

  it('maps past_due status on customer.subscription.updated', async () => {
    await processStripeEvent({
      id: 'evt_3',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_test_3',
          status: 'past_due',
          cancel_at_period_end: false,
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          customer: 'cus_test_1',
          metadata: { userId: 'user-123' },
          items: { data: [{ price: { id: 'price_pro_test' } }] },
        },
      },
    } as any);

    const write = mockDb.writes.find(
      (w: any) => (w.op === 'update' || w.op === 'insert') && w.table === 'subscriptions'
    );
    expect(write.payload.status).toBe('past_due');
  });

  it('skips duplicate events (idempotent against Stripe retries)', async () => {
    mockDb.events.add('evt_duplicate');

    const result = await processStripeEvent({
      id: 'evt_duplicate',
      type: 'checkout.session.completed',
      data: { object: {} },
    } as any);

    expect(result).toEqual({ handled: false, duplicate: true });
    expect(mockDb.writes).toHaveLength(0);
  });

  it('ignores unrelated event types without side effects', async () => {
    const result = await processStripeEvent({
      id: 'evt_ping',
      type: 'ping',
      data: { object: {} },
    } as any);

    expect(result.handled).toBe(true);
    expect(mockDb.writes).toHaveLength(0);
    expect(mockDb.events.has('evt_ping')).toBe(true);
  });

  it('records paid invoices against the user’s subscription', async () => {
    mockDb.responses['subscriptions'] = { data: { user_id: 'user-123', id: 'sub_row_id' }, error: null };

    const result = await processStripeEvent({
      id: 'evt_inv',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_test_1',
          amount_paid: 2000,
          currency: 'usd',
          period_start: 1700000000,
          period_end: 1702592000,
          subscription: 'sub_test_1',
        },
      },
    } as any);

    expect(result.handled).toBe(true);
    const invoice = mockDb.writes.find((w: any) => w.op === 'insert' && w.table === 'invoices');
    expect(invoice).toBeDefined();
    expect(invoice.payload).toMatchObject({
      user_id: 'user-123',
      subscription_id: 'sub_row_id',
      amount_cents: 2000,
      status: 'paid',
      provider_invoice_id: 'in_test_1',
    });
  });

  it('records failed invoices on payment_failure', async () => {
    mockDb.responses['subscriptions'] = { data: { user_id: 'user-123', id: 'sub_row_id' }, error: null };

    await processStripeEvent({
      id: 'evt_fail_inv',
      type: 'invoice.payment_failed',
      data: {
        object: { id: 'in_test_2', amount_due: 6000, currency: 'usd', subscription: 'sub_test_1' },
      },
    } as any);

    const invoice = mockDb.writes.find((w: any) => w.op === 'insert' && w.table === 'invoices');
    expect(invoice.payload.status).toBe('failed');
    expect(invoice.payload.amount_cents).toBe(6000);
  });

  it('marks subscriptions canceled on customer.subscription.deleted', async () => {
    await processStripeEvent({
      id: 'evt_cancel',
      type: 'customer.subscription.deleted',
      data: {
        object: { id: 'sub_test_x', status: 'canceled', metadata: { userId: 'user-123' } },
      },
    } as any);

    const update = mockDb.writes.find((w: any) => w.op === 'update' && w.table === 'subscriptions');
    expect(update.payload.status).toBe('canceled');
    expect(update.payload.cancel_at_period_end).toBe(false);
  });

  it('skips checkout sessions without user/plan metadata', async () => {
    return processStripeEvent({
      id: 'evt_meta',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_meta' } },
    } as any).then((result) => {
      expect(result.handled).toBe(true);
      expect(mockDb.writes).toHaveLength(0);
    });
  });

  it('activates with default period data when subscription enrichment fails', async () => {
    mockStripe.retrieveSubscription.mockRejectedValue(new Error('stripe down'));

    await processStripeEvent({
      id: 'evt_enrich',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_enrich',
          client_reference_id: 'user-123',
          customer: 'cus_test_1',
          subscription: 'sub_test_1',
          metadata: { userId: 'user-123', planId: 'team' },
        },
      },
    } as any);

    const write = mockDb.writes.find((w: any) => w.op === 'insert' && w.table === 'subscriptions');
    expect(write.payload).toMatchObject({ plan_id: 'team', status: 'active' });
    expect(write.payload.current_period_start).toBeTruthy();
  });

  it('supports the current_period object shape and infers the plan from the price', async () => {
    await processStripeEvent({
      id: 'evt_period',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_period',
          status: 'unpaid', // maps to past_due
          cancel_at_period_end: true,
          current_period: { start: 1700000000, end: 1702592000 },
          customer: 'cus_test_1',
          metadata: { userId: 'user-123' },
          items: { data: [{ price: { id: 'price_team_test' } }] },
        },
      },
    } as any);

    const write = mockDb.writes.find(
      (w: any) => (w.op === 'update' || w.op === 'insert') && w.table === 'subscriptions'
    );
    expect(write.payload.status).toBe('past_due');
    expect(write.payload.plan_id).toBe('team');
    expect(write.payload.cancel_at_period_end).toBe(true);
    expect(write.payload.current_period_start).toContain('2023-11-14');
  });

  it('does not record an invoice when the subscription cannot be resolved', async () => {
    const result = await processStripeEvent({
      id: 'evt_no_sub',
      type: 'invoice.paid',
      data: {
        object: { id: 'in_orphan', amount_paid: 100, currency: 'usd', subscription: 'sub_unknown' },
      },
    } as any);

    expect(result.handled).toBe(true);
    expect(mockDb.writes).toHaveLength(0);
  });

  it('rethrows on processing failure and never records the event (Stripe will retry)', async () => {
    mockDb.throwOnInsert = true;

    await expect(
      processStripeEvent({
        id: 'evt_boom',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_boom',
            client_reference_id: 'user-123',
            metadata: { userId: 'user-123', planId: 'pro' },
          },
        },
      } as any)
    ).rejects.toThrow('boom');

    expect(mockDb.events.has('evt_boom')).toBe(false);
  });
});
