/**
 * services/stripe.ts
 * OWNS: Stripe payment integration (checkout, billing portal, webhooks).
 *
 * Designed for TEST MODE: everything activates the moment
 *   STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PRICE_PRO /
 *   STRIPE_PRICE_TEAM
 * are configured. Until then the billing routes return the
 * `payment_provider_not_configured` contract and nothing leaks.
 *
 * Webhook events are processed idempotently via the `stripe_events` table
 * (migration 006) — Stripe retries are safe.
 *
 * SECURITY:
 *   - Webhook payloads are verified with constructEvent (signature check).
 *   - Metadata carries the app user id; lookups never trust client input.
 *   - No secrets are ever logged.
 *
 * NOTE: webhook handlers consume local structural types instead of the SDK's
 * object types — Stripe reshapes fields across API versions (e.g.
 * current_period.start/end, invoice.subscription_details) and the handlers
 * defensively support both shapes so SDK upgrades never break billing.
 */
import Stripe from 'stripe';
import { Settings } from '../config/settings';
import { getPlan } from './billing';
import {
  getSupabase,
  hasStripeEvent,
  recordStripeEvent,
  getStripeCustomerId,
  recordAudit,
} from './supabase';

let client: Stripe | null = null;

/** True once all keys needed for real Stripe calls are configured. */
export function isStripeConfigured(): boolean {
  return Boolean(
    Settings.STRIPE_SECRET_KEY &&
      Settings.STRIPE_WEBHOOK_SECRET &&
      Settings.STRIPE_PRICE_PRO &&
      Settings.STRIPE_PRICE_TEAM
  );
}

function getStripe(): Stripe {
  if (client) return client;
  if (!Settings.STRIPE_SECRET_KEY) throw new Error('Stripe is not configured');
  client = new Stripe(Settings.STRIPE_SECRET_KEY);
  return client;
}

const PRICE_IDS: Record<string, string | undefined> = {
  pro: Settings.STRIPE_PRICE_PRO || undefined,
  team: Settings.STRIPE_PRICE_TEAM || undefined,
};

// ── Local structural types (SDK-version resilient) ──────────────────────────

interface SubscriptionLike {
  id: string;
  status: string;
  cancel_at_period_end?: boolean;
  current_period_start?: number;
  current_period_end?: number;
  current_period?: { start?: number; end?: number };
  customer?: string | { id?: string };
  items?: { data?: Array<{ price?: { id?: string } }> };
  metadata?: Record<string, string>;
}

interface InvoiceLike {
  id: string;
  amount_paid?: number;
  amount_due?: number;
  currency?: string;
  period_start?: number;
  period_end?: number;
  subscription?: string | null;
  subscription_details?: { subscription?: string | null };
  customer?: string | { id?: string };
}

function idOf(value: string | { id?: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id || null;
}

function periodOf(sub: SubscriptionLike): { start: string; end: string } {
  const startSec = sub.current_period?.start ?? sub.current_period_start;
  const endSec = sub.current_period?.end ?? sub.current_period_end;
  return {
    start: startSec ? new Date(startSec * 1000).toISOString() : new Date().toISOString(),
    end: endSec
      ? new Date(endSec * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  };
}

// ── Checkout ────────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  userId: string,
  planId: string,
  email?: string
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  const price = PRICE_IDS[planId];
  if (!price) throw new Error(`No Stripe price configured for plan '${planId}'`);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    success_url: `${Settings.FRONTEND_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${Settings.FRONTEND_URL}/?checkout=cancelled`,
    client_reference_id: userId,
    ...(email ? { customer_email: email } : {}),
    metadata: { userId, planId },
    subscription_data: { metadata: { userId, planId } },
  });

  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  return { url: session.url, sessionId: session.id };
}

// ── Billing portal ──────────────────────────────────────────────────────────

export async function createPortalSession(userId: string): Promise<{ url: string }> {
  const stripe = getStripe();
  const customerId = await getStripeCustomerId(userId);
  if (!customerId) {
    throw new Error('No Stripe customer found for this account');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${Settings.FRONTEND_URL}/?portal=return`,
  });
  return { url: session.url };
}

// ── Webhooks ────────────────────────────────────────────────────────────────

/** Verify a webhook payload signature. Throws on invalid signatures. */
export function verifyWebhook(rawBody: Buffer | string, signature: string): Stripe.Event {
  const stripe = getStripe();
  if (!Settings.STRIPE_WEBHOOK_SECRET) throw new Error('Stripe webhook secret is not configured');
  return stripe.webhooks.constructEvent(rawBody, signature, Settings.STRIPE_WEBHOOK_SECRET);
}

/**
 * Process a verified Stripe event. Idempotent: events already recorded in
 * `stripe_events` are skipped. Throws on processing failure so Stripe retries.
 */
export async function processStripeEvent(
  event: Stripe.Event
): Promise<{ handled: boolean; duplicate: boolean }> {
  if (await hasStripeEvent(event.id)) {
    return { handled: false, duplicate: true };
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await onCheckoutCompleted(event.data.object as any);
        break;
      case 'customer.subscription.updated':
        await onSubscriptionUpdated(event.data.object as any);
        break;
      case 'customer.subscription.deleted':
        await onSubscriptionDeleted(event.data.object as any);
        break;
      case 'invoice.paid':
        await onInvoicePaid(event.data.object as any);
        break;
      case 'invoice.payment_failed':
        await onInvoicePaymentFailed(event.data.object as any);
        break;
      default:
        break; // unrelated events (e.g. ping) are ack'd without side effects
    }
    await recordStripeEvent(event.id, event.type);
    return { handled: true, duplicate: false };
  } catch (error: any) {
    // Do NOT record the event: Stripe will retry, and a transient failure
    // must not be permanently swallowed.
    console.error(`[stripe] event processing failed (${event.type}): ${error?.message || 'unknown error'}`);
    throw error;
  }
}

// ── Event handlers ──────────────────────────────────────────────────────────

async function onCheckoutCompleted(session: any): Promise<void> {
  const userId = session?.metadata?.userId || session?.client_reference_id;
  const planId = session?.metadata?.planId || '';
  if (!userId || !getPlan(planId)) {
    console.warn('[stripe] checkout session missing userId/plan metadata — skipping');
    return;
  }

  const stripe = getStripe();
  let status = 'active';
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  let subscriptionId: string | null = idOf(session?.subscription);

  // Best-effort enrich from the live subscription object.
  try {
    if (subscriptionId) {
      const sub = (await stripe.subscriptions.retrieve(subscriptionId)) as unknown as SubscriptionLike;
      status = mapSubscriptionStatus(sub.status);
      const period = periodOf(sub);
      periodStart = period.start;
      periodEnd = period.end;
      subscriptionId = sub.id || subscriptionId;
    }
  } catch {
    /* enrichment optional — metadata still gives us a usable row */
  }

  // Defaults when the live subscription could not be enriched (the webhook
  // for subscription.updated will correct the dates moments later).
  const now = new Date().toISOString();
  await upsertSubscription(userId, {
    planId,
    status,
    currentPeriodStart: periodStart || now,
    currentPeriodEnd: periodEnd || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    cancelAtPeriodEnd: false,
    stripeCustomerId: idOf(session?.customer),
    stripeSubscriptionId: subscriptionId,
  });

  await recordAudit({ actorType: 'user', actorId: userId, action: 'billing.subscription_activated', resource: planId });
}

async function onSubscriptionUpdated(sub: SubscriptionLike): Promise<void> {
  const userId = sub.metadata?.userId;
  if (!userId) return; // unknown owner — nothing to update

  const period = periodOf(sub);
  await upsertSubscription(userId, {
    planId: sub.metadata?.planId || inferPlanFromPrice(sub) || 'pro',
    status: mapSubscriptionStatus(sub.status),
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    stripeCustomerId: idOf(sub.customer),
    stripeSubscriptionId: sub.id,
  });
}

async function onSubscriptionDeleted(sub: SubscriptionLike): Promise<void> {
  const userId = sub.metadata?.userId;
  if (!userId) return;

  const db = getSupabase();
  if (!db) return;
  await db
    .from('subscriptions')
    .update({ status: 'canceled', cancel_at_period_end: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('stripe_subscription_id', sub.id);
}

async function onInvoicePaid(invoice: InvoiceLike): Promise<void> {
  await recordInvoice(invoice, 'paid', invoice.amount_paid ?? 0);
}

async function onInvoicePaymentFailed(invoice: InvoiceLike): Promise<void> {
  await recordInvoice(invoice, 'failed', invoice.amount_due ?? 0);
}

async function recordInvoice(invoice: InvoiceLike, status: string, amountCents: number): Promise<void> {
  const db = getSupabase();
  if (!db) return;

  const stripeSubscriptionId = invoice.subscription || invoice.subscription_details?.subscription || null;
  const userId = await resolveUserIdForSubscription(stripeSubscriptionId);
  if (!userId) return;

  const subId = await resolveSubscriptionRowId(userId, stripeSubscriptionId);
  await db.from('invoices').insert({
    subscription_id: subId,
    user_id: userId,
    amount_cents: amountCents,
    currency: invoice.currency || 'usd',
    status,
    period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
    period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
    provider_invoice_id: invoice.id,
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapSubscriptionStatus(status: string): string {
  switch (status) {
    case 'active':
    case 'trialing':
      return status;
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return 'canceled';
    default:
      return 'active';
  }
}

/** Fallback plan inference from the subscription's price id (env-configured). */
function inferPlanFromPrice(sub: SubscriptionLike): string | null {
  const priceId = sub.items?.data?.[0]?.price?.id;
  if (priceId === Settings.STRIPE_PRICE_PRO) return 'pro';
  if (priceId === Settings.STRIPE_PRICE_TEAM) return 'team';
  return null;
}

/** Upsert a user's live subscription row (one active/trialing per user). */
async function upsertSubscription(
  userId: string,
  fields: {
    planId: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  }
): Promise<void> {
  const db = getSupabase();
  if (!db) return;

  // Update the existing live row if present, otherwise insert a new one.
  const { data: existing } = await db
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .limit(1)
    .maybeSingle();

  const payload = {
    plan_id: fields.planId,
    status: fields.status,
    current_period_start: fields.currentPeriodStart,
    current_period_end: fields.currentPeriodEnd,
    cancel_at_period_end: fields.cancelAtPeriodEnd,
    stripe_customer_id: fields.stripeCustomerId,
    stripe_subscription_id: fields.stripeSubscriptionId,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    await db.from('subscriptions').update(payload).eq('id', existing.id);
  } else {
    await db.from('subscriptions').insert({ user_id: userId, ...payload });
  }
}

async function resolveUserIdForSubscription(stripeSubscriptionId: string | null): Promise<string | null> {
  if (!stripeSubscriptionId) return null;
  const db = getSupabase();
  if (!db) return null;
  const { data } = await db
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .limit(1)
    .maybeSingle();
  return (data?.user_id as string) || null;
}

async function resolveSubscriptionRowId(userId: string, stripeSubscriptionId: string | null): Promise<string | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data } = await db
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .limit(1)
    .maybeSingle();
  return (data?.id as string) || null;
}
