/**
 * routes/billing.stripe.test.ts — Billing endpoints with Stripe configured
 * (TEST MODE). The stripe service module is mocked so no real Stripe calls
 * happen; this exercises the route wiring: checkout session URL, portal URL,
 * and signature-verified webhook processing (raw body → constructEvent).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { withServer, jsonFetch } from '../test-utils/http';

const { stripeMock } = vi.hoisted(() => ({
  stripeMock: {
    isConfigured: true,
    checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_route',
    portalUrl: 'https://billing.stripe.com/p/session/route',
    constructEvent: vi.fn(),
    processResult: { handled: true, duplicate: false },
    processedEvents: [] as string[],
  },
}));

vi.hoisted(() => {
  process.env.GROQ_API_KEY = 'gsk_test_server_key';
  process.env.JWT_SECRET = 'test-secret-for-stripe-routes';
  process.env.RATE_LIMIT_MAX = '100000';
  process.env.STRIPE_SECRET_KEY = 'sk_test_route';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_route';
  process.env.STRIPE_PRICE_PRO = 'price_pro_route';
  process.env.STRIPE_PRICE_TEAM = 'price_team_route';
});

vi.mock('../services/stripe', () => ({
  isStripeConfigured: () => stripeMock.isConfigured,
  createCheckoutSession: async (userId: string, planId: string) => ({
    url: stripeMock.checkoutUrl,
    sessionId: `cs_${planId}`,
  }),
  createPortalSession: async () => ({ url: stripeMock.portalUrl }),
  verifyWebhook: (raw: Buffer, signature: string) => {
    if (signature === 'bad-signature') throw new Error('No signatures found');
    return { id: 'evt_route', type: 'checkout.session.completed' };
  },
  processStripeEvent: async (event: any) => {
    stripeMock.processedEvents = stripeMock.processedEvents || [];
    stripeMock.processedEvents.push(event.id);
    return stripeMock.processResult;
  },
}));

import app from '../index';
import { Settings } from '../config/settings';

const token = jwt.sign({ userId: 'stripe-route-user', email: 'sr@user.dev' }, Settings.JWT_SECRET);
const headers = { Authorization: `Bearer ${token}` };

beforeEach(() => {
  stripeMock.processedEvents = [];
});

describe('POST /api/billing/checkout — Stripe configured', () => {
  it('returns a checkout session URL for a valid plan', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/billing/checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ planId: 'pro' }),
      });
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.url).toBe(stripeMock.checkoutUrl);
      expect(body.planId).toBe('pro');
    });
  });

  it('still rejects invalid plan ids', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/billing/checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ planId: 'platinum' }),
      });
      expect(status).toBe(400);
    });
  });

  it('rejects non-string plan ids', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/billing/checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ planId: 42 }),
      });
      expect(status).toBe(400);
    });
  });

  it('maps Stripe failures to a clean 500 without leaking internals', async () => {
    // Simulate the Stripe call blowing up (e.g. bad secret key).
    const mod = await import('../services/stripe');
    vi.spyOn(mod, 'createCheckoutSession').mockRejectedValueOnce(new Error('Invalid API Key provided: sk_test_***'));

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/billing/checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ planId: 'pro' }),
      });
      expect(status).toBe(500);
      expect(body.error).toBe('Failed to start checkout');
      expect(JSON.stringify(body)).not.toContain('sk_test');
    });
  });

  it('returns the not-configured message when the Stripe client is unavailable', async () => {
    const mod = await import('../services/stripe');
    vi.spyOn(mod, 'createCheckoutSession').mockRejectedValueOnce(new Error('Stripe is not configured'));

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/billing/checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ planId: 'pro' }),
      });
      expect(status).toBe(500);
      expect(body.error).toBe('Payment processing is not configured');
    });
  });
});

describe('POST /api/billing/portal — Stripe configured', () => {
  it('returns a billing portal URL', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/billing/portal`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.url).toBe(stripeMock.portalUrl);
    });
  });

  it('reports a clean 500 when no Stripe customer exists', async () => {
    const mod = await import('../services/stripe');
    vi.spyOn(mod, 'createPortalSession').mockRejectedValueOnce(new Error('No Stripe customer found for this account'));

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/billing/portal`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      expect(status).toBe(500);
      expect(body.error).toBe('No active subscription for this account');
    });
  });
});

describe('POST /api/billing/webhook — signature-verified', () => {
  it('accepts a valid signature and processes the event idempotently', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/billing/webhook`, {
        method: 'POST',
        headers: { 'stripe-signature': 't=1700000000,v1=valid' },
        body: JSON.stringify({ id: 'evt_route', type: 'checkout.session.completed' }),
      });
      expect(status).toBe(200);
      expect(body.received).toBe(true);
      expect(stripeMock.processedEvents).toEqual(['evt_route']);
    });
  });

  it('rejects requests without a Stripe signature', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/billing/webhook`, {
        method: 'POST',
        body: JSON.stringify({ id: 'evt_no_sig' }),
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Missing Stripe signature');
    });
  });

  it('rejects an invalid signature with 400 (never 500)', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/billing/webhook`, {
        method: 'POST',
        headers: { 'stripe-signature': 'bad-signature' },
        body: JSON.stringify({ id: 'evt_bad_sig' }),
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid Stripe signature');
      expect(stripeMock.processedEvents).toEqual([]);
    });
  });
});
