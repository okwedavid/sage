/**
 * components/pages/BillingPage.tsx — Subscription & usage (commercial platform)
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Gauge, Sparkles, Check, Loader2, ArrowUpRight, Settings2 } from 'lucide-react';
import { api } from '@/lib/api';

interface Plan {
  id: string;
  name: string;
  description: string;
  priceUsdCents: number;
  currency: string;
  billingInterval: string;
  dailyRequestLimit: number;
  features: string[];
}

interface BillingPlanResponse {
  plan: { id: string; name: string; priceUsdCents: number; features: string[] };
  subscription: { status: string; currentPeriodEnd: string | null };
  quota: { limit: number; used: number; remaining: number; unlimited: boolean };
}

const priceLabel = (cents: number) => (cents === 0 ? '$0' : `$${(cents / 100).toFixed(0)}`);

export function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<BillingPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutMsg, setCheckoutMsg] = useState('');
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [stripeNotice, setStripeNotice] = useState('');

  // Show a banner when Stripe redirects back after checkout / portal.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      setStripeNotice('Your subscription is being activated. Your plan and usage will refresh shortly.');
    } else if (params.get('checkout') === 'cancelled') {
      setStripeNotice('Checkout cancelled — your plan has not changed.');
    } else if (params.get('portal') === 'return') {
      setStripeNotice('Your billing details have been updated.');
    }
    if (params.has('checkout') || params.has('portal')) {
      params.delete('checkout');
      params.delete('session_id');
      params.delete('portal');
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, '', next);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [plansRes, planRes] = await Promise.all([api.getBillingPlans(), api.getBillingPlan()]);
      setPlans(plansRes.plans || []);
      setCurrent(planRes);
    } catch {
      // Fall back to catalog-only if the plan endpoint fails (e.g. stale backend)
      try {
        const plansRes = await api.getBillingPlans();
        setPlans(plansRes.plans || []);
      } catch {
        /* backend unreachable — empty state handles it */
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpgrade = async (planId: string) => {
    setBusyPlan(planId);
    setCheckoutMsg('');
    try {
      const res = await api.requestCheckout(planId);
      if (res?.url) {
        // Stripe Checkout session — send the user to the hosted checkout page.
        window.location.href = res.url;
        return;
      }
      // Backend not configured: show the structured message.
      setCheckoutMsg(
        res.message ||
          'Upgrades are not available yet — payment processing is being configured. Contact sales@sage.ai.'
      );
    } catch (e: any) {
      const body = e?.body;
      setCheckoutMsg(
        body?.message ||
          body?.error ||
          e?.message ||
          'Upgrades are not available yet — payment processing is being configured. Contact sales@sage.ai.'
      );
    } finally {
      setBusyPlan(null);
    }
  };

  const handlePortal = async () => {
    setPortalBusy(true);
    setCheckoutMsg('');
    try {
      const res = await api.requestBillingPortal();
      if (res?.url) {
        window.location.href = res.url;
        return;
      }
      setCheckoutMsg(res?.message || 'The billing portal is not available yet.');
    } catch (e: any) {
      const body = e?.body;
      setCheckoutMsg(
        body?.message || body?.error || e?.message || 'The billing portal is not available yet.'
      );
    } finally {
      setPortalBusy(false);
    }
  };

  const isPaidPlan = !!current && current.plan.id !== 'free';

  const usagePct = current && current.quota.limit > 0 ? Math.min(100, (current.quota.used / current.quota.limit) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-txt-primary mb-2">Billing</h1>
        <p className="text-txt-secondary text-sm">
          Manage your subscription, monitor usage, and scale as you grow.
        </p>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-txt-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading billing…
        </div>
      ) : (
        <>
          {/* Current plan + usage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-display text-lg font-bold text-txt-primary flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-accent-primary" /> Current Plan
                </h2>
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-gradient-button text-white">
                  {current?.plan.name || 'Free'}
                </span>
              </div>
              <p className="text-txt-secondary text-sm mb-4">
                {current?.plan.priceUsdCents === 0 ? 'Free forever — no card required' : current ? `${priceLabel(current.plan.priceUsdCents)}/month` : 'Loading plan...'}
              </p>
              <ul className="space-y-2">
                {(current?.plan.features || []).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-txt-secondary">
                    <Check className="w-4 h-4 text-status-success shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              {current?.subscription?.status && current.subscription.status !== 'active' && (
                <p className="mt-4 text-xs text-txt-muted">Status: {current.subscription.status}</p>
              )}
              {isPaidPlan && (
                <button
                  onClick={handlePortal}
                  disabled={portalBusy}
                  className="mt-4 w-full py-2.5 rounded-xl bg-sage-card border border-sage-border text-sm font-semibold text-txt-primary flex items-center justify-center gap-1.5 hover:border-accent-primary/40 hover:bg-sage-hover transition-all disabled:opacity-60"
                >
                  {portalBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
                  Manage Billing
                </button>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
              <h2 className="font-display text-lg font-bold text-txt-primary mb-1 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-accent-secondary" /> Today&apos;s Usage
              </h2>
              {current?.quota.unlimited ? (
                <p className="text-sm text-txt-secondary mt-2">Unlimited requests on your plan.</p>
              ) : current ? (
                <>
                  <div className="flex items-end justify-between mt-4 mb-2">
                    <span className="font-mono text-3xl font-bold text-txt-primary">
                      {current.quota.used ?? 0}
                      <span className="text-base font-normal text-txt-muted"> / {current.quota.limit}</span>
                    </span>
                    <span className="text-xs font-mono text-txt-muted">requests today</span>
                  </div>
                  <div className="h-3 rounded-full bg-sage-input overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${usagePct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className={`h-full rounded-full ${usagePct >= 90 ? 'bg-status-error' : 'bg-gradient-primary'}`}
                    />
                  </div>
                  <p className="text-xs text-txt-muted mt-2">
                    {current.quota.remaining} request{current.quota.remaining === 1 ? '' : 's'} remaining today. Resets at midnight UTC.
                  </p>
                  {current.quota.remaining <= 0 && (
                    <p className="text-xs text-status-error mt-1 font-medium">
                      Limit reached — requests will be rejected until the daily reset.
                    </p>
                  )}
                  {usagePct >= 90 && (
                    <p className="text-xs text-status-error mt-3 font-medium">
                      You&apos;re close to your limit — upgrade to keep the momentum going.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-txt-muted mt-2">Unable to load usage data.</p>
              )}
            </motion.div>
          </div>

          {/* Stripe return notice */}
          {stripeNotice && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-status-success/10 border border-status-success/30 text-txt-secondary text-sm flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-status-success shrink-0" />
              {stripeNotice}
            </motion.div>
          )}

          {/* Checkout notice */}
          {checkoutMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-accent-primary/10 border border-accent-primary/30 text-txt-secondary text-sm flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-accent-primary shrink-0" />
              {checkoutMsg}
            </motion.div>
          )}

          {/* Plan comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan, i) => {
              const isCurrent = current?.plan.id === plan.id;
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + i * 0.06 }}
                  className={`glass-card p-6 flex flex-col ${isCurrent ? 'ring-1 ring-accent-primary/60 shadow-glow-md' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-display text-lg font-bold text-txt-primary">{plan.name}</h3>
                    {isCurrent && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-accent-primary/20 text-accent-primary">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-txt-muted mb-3">{plan.description}</p>
                  <div className="mb-4">
                    <span className="font-mono text-2xl font-bold text-txt-primary">{priceLabel(plan.priceUsdCents)}</span>
                    <span className="text-xs text-txt-muted">/month</span>
                  </div>
                  <ul className="space-y-2 flex-1 mb-5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px] text-txt-secondary">
                        <Check className="w-3.5 h-3.5 text-status-success shrink-0 mt-0.5" /> {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <button disabled className="w-full py-2.5 rounded-xl bg-sage-input text-txt-muted text-sm font-semibold cursor-default">
                      Your Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={busyPlan !== null}
                      className="w-full py-2.5 rounded-xl bg-gradient-button text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:shadow-glow-md hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:translate-y-0"
                    >
                      {busyPlan === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
                      Upgrade
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
