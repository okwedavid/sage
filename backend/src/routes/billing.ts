/**
 * routes/billing.ts
 * OWNS: Billing endpoints — plan visibility + subscription management hooks.
 *
 * GET  /api/billing/plans            → public plan catalog (no auth)
 * GET  /api/billing/plan             → my effective plan + usage + quota (auth)
 * POST /api/billing/checkout         → start an upgrade (provider-gated)
 * POST /api/billing/portal           → manage billing (provider-gated)
 *
 * The checkout/portal endpoints return a structured `not_configured` response
 * until a payment provider (Stripe) is wired — the exact hook where the
 * provider SDK + webhook land (see COMMERCIAL_READINESS.md).
 */
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { listPlans, getEffectivePlan, enforceChatQuota } from '../services/billing';
import { recordAudit } from '../services/supabase';

const router = Router();

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

// POST /api/billing/checkout — start an upgrade
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

    // Billing-READY hook: return the exact contract a provider integration
    // will fulfill (e.g. Stripe Checkout Session URL).
    res.status(501).json({
      ok: false,
      code: 'payment_provider_not_configured',
      message: 'Payment processing is not configured yet. Contact sales@sage.ai to upgrade.',
      planId,
      requiredEnv: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_PRO', 'STRIPE_PRICE_TEAM'],
    });
  } catch (error: any) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to start checkout' });
  }
});

// POST /api/billing/portal — manage subscription/billing details
router.post('/portal', authMiddleware, async (_req: AuthRequest, res: Response) => {
  res.status(501).json({
    ok: false,
    code: 'payment_provider_not_configured',
    message: 'The billing portal is not available until payment processing is configured.',
    requiredEnv: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  });
});

export default router;
