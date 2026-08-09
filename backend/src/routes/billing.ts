/**
 * routes/billing.ts
 * OWNS: Billing endpoints — plan visibility + subscription management.
 *
 * GET  /api/billing/plans            → public plan catalog (no auth)
 * GET  /api/billing/plan             → my effective plan + usage + quota (auth)
 * POST /api/billing/checkout         → start an upgrade (Stripe Checkout)
 * POST /api/billing/portal           → manage billing (Stripe portal)
 * POST /api/billing/webhook          → Stripe webhook (signature-verified)
 *
 * Stripe TEST MODE: everything activates when STRIPE_SECRET_KEY,
 * STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO and STRIPE_PRICE_TEAM are set.
 * Until then checkout/portal return the structured `not_configured`
 * contract and webhooks answer 501 — nothing breaks, nothing leaks.
 */
import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { listPlans, getEffectivePlan, enforceChatQuota } from '../services/billing';
import {
  isStripeConfigured,
  createCheckoutSession,
  createPortalSession,
  verifyWebhook,
  processStripeEvent,
} from '../services/stripe';
import { recordAudit } from '../services/supabase';

const router = Router();

const NOT_CONFIGURED_ENV = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_PRO', 'STRIPE_PRICE_TEAM'];

// GET /api/billing/plans — public catalog (pricing page / comparison)
router.get('/plans', (_req: any, res: Response) => {
  res.json({ plans: listPlans() });
});

// GET /api/billing/plan — authenticated user's plan + usage
router.get('/plan', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [{ plan, status, currentPeriodEnd }, quota] = await Promise.all([
      getEffectivePlan(req.userId!),
      enforceChatQuota(req.userId!),
    ]);

    res.json({
      plan: {
        id: plan.id,
        name: plan.name,
        priceUsdCents: plan.priceUsdCents,
        features: plan.features,
      },
      subscription: { status, currentPeriodEnd },
      quota: {
        limit: quota.limit,
        used: quota.used,
        remaining: quota.remaining, // -1 = unlimited
        unlimited: quota.limit === 0,
      },
    });
  } catch (error: any) {
    console.error('Billing plan error:', error);
    res.status(500).json({ error: 'Failed to load billing information' });
  }
});

// POST /api/billing/checkout — start an upgrade (Stripe Checkout Session)
// body: { planId: 'pro' | 'team' }
router.post('/checkout', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { planId } = req.body || {};
    if (typeof planId !== 'string' || !['pro', 'team'].includes(planId)) {
      res.status(400).json({ error: 'planId must be "pro" or "team"' });
      return;
    }

    await recordAudit({
      actorType: 'user',
      actorId: req.userId,
      action: 'billing.checkout_requested',
      resource: planId,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || '',
      userAgent: req.headers['user-agent'] as string,
    });

    if (!isStripeConfigured()) {
      res.status(501).json({
        ok: false,
        code: 'payment_provider_not_configured',
        message: 'Payment processing is not configured yet. Contact sales@sage.ai to upgrade.',
        planId,
        requiredEnv: NOT_CONFIGURED_ENV,
      });
      return;
    }

    const session = await createCheckoutSession(req.userId!, planId, req.userEmail);
    res.json({ ok: true, url: session.url, sessionId: session.sessionId, planId });
  } catch (error: any) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error?.message === 'Stripe is not configured' ? 'Payment processing is not configured' : 'Failed to start checkout' });
  }
});

// POST /api/billing/portal — manage subscription/billing details
router.post('/portal', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!isStripeConfigured()) {
      res.status(501).json({
        ok: false,
        code: 'payment_provider_not_configured',
        message: 'The billing portal is not available until payment processing is configured.',
        requiredEnv: NOT_CONFIGURED_ENV,
      });
      return;
    }
    const session = await createPortalSession(req.userId!);
    res.json({ ok: true, url: session.url });
  } catch (error: any) {
    console.error('Portal error:', error);
    res.status(500).json({ error: error?.message === 'No Stripe customer found for this account' ? 'No active subscription for this account' : 'Failed to open billing portal' });
  }
});

// POST /api/billing/webhook — Stripe webhook (raw body is parsed in index.ts)
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    if (!isStripeConfigured()) {
      res.status(501).json({ error: 'Stripe is not configured' });
      return;
    }

    const signature = req.headers['stripe-signature'];
    if (!signature || Array.isArray(signature)) {
      res.status(400).json({ error: 'Missing Stripe signature' });
      return;
    }

    // Raw JSON body (Buffer) mounted via express.raw in index.ts.
    const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''), 'utf8');
    const event = verifyWebhook(rawBody, signature);

    // Idempotent processing — safe against Stripe retries.
    const result = await processStripeEvent(event);
    if (result.duplicate) {
      res.json({ received: true, duplicate: true });
      return;
    }
    res.json({ received: true });
  } catch (error: any) {
    // ConstructEvent throws on ANY signature mismatch — always 400, never 500.
    console.warn('[stripe] webhook verification failed');
    res.status(400).json({ error: 'Invalid Stripe signature' });
  }
});

export default router;
