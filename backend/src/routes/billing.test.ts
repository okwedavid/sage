/**
 * routes/billing.test.ts — Integration tests for billing endpoints
 * (public catalog, effective plan + usage, provider-gated checkout/portal).
 */
import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { withServer, jsonFetch } from '../test-utils/http';

vi.hoisted(() => {
  process.env.GROQ_API_KEY = 'gsk_test_server_key';
  process.env.JWT_SECRET = 'test-secret-for-billing-routes';
});

import app from '../index';
import { Settings } from '../config/settings';

const token = jwt.sign({ userId: 'bill-user-1', email: 'bill@user.dev' }, Settings.JWT_SECRET);
const authHeaders = { Authorization: `Bearer ${token}` };

describe('GET /api/billing/plans', () => {
  it('returns the public plan catalog without auth', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/billing/plans`);
      expect(status).toBe(200);
      expect(body.plans.map((p: any) => p.id)).toEqual(['free', 'pro', 'team']);
      expect(body.plans[1].priceUsdCents).toBe(2000);
    });
  });
});

describe('GET /api/billing/plan', () => {
  it('requires auth', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/billing/plan`);
      expect(status).toBe(401);
    });
  });

  it('returns the Free plan with usage quota for a new user', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/billing/plan`, {
        headers: authHeaders,
      });
      expect(status).toBe(200);
      expect(body.plan.id).toBe('free');
      expect(body.plan.name).toBe('Free');
      expect(body.subscription.status).toBe('active');
      expect(body.quota.limit).toBe(20);
      expect(body.quota.used).toBe(0);
      expect(body.quota.remaining).toBe(20);
      expect(body.quota.unlimited).toBe(false);
    });
  });
});

describe('POST /api/billing/checkout', () => {
  it('rejects invalid plan ids', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/billing/checkout`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ planId: 'platinum' }),
      });
      expect(status).toBe(400);
    });
  });

  it('returns a structured not-configured response until a payment provider is wired', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/billing/checkout`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ planId: 'pro' }),
      });
      expect(status).toBe(501);
      expect(body.code).toBe('payment_provider_not_configured');
      expect(body.planId).toBe('pro');
      expect(body.requiredEnv).toContain('STRIPE_SECRET_KEY');
    });
  });
});

describe('POST /api/billing/portal', () => {
  it('returns not-configured until a payment provider is wired', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/billing/portal`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      });
      expect(status).toBe(501);
      expect(body.code).toBe('payment_provider_not_configured');
    });
  });
});

describe('POST /api/billing/webhook', () => {
  it('returns 501 until Stripe is configured', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/billing/webhook`, {
        method: 'POST',
        headers: { 'stripe-signature': 't=1700000000,v1=x' },
        body: JSON.stringify({ id: 'evt_1', type: 'ping' }),
      });
      expect(status).toBe(501);
      expect(body.error).toBe('Stripe is not configured');
    });
  });
});
