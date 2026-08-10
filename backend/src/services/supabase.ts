/**
 * services/supabase.ts
 * OWNS: Supabase client initialization + persistence layer
 *
 * Every function degrades gracefully: if Supabase is not configured the
 * functions return null/[] so callers can fall back to in-memory behavior.
 * All access uses the service role key, which bypasses RLS.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Settings } from '../config/settings';

let supabase: SupabaseClient | null = null;

/** The service key must be present and the URL must be a real http(s) URL. */
function isConfigValid(): boolean {
  const url = Settings.SUPABASE_URL.trim();
  return Boolean(url && Settings.SUPABASE_SERVICE_KEY && /^https?:\/\//.test(url));
}

export function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;

  if (!isConfigValid()) {
    console.warn('⚠️ Supabase not configured (or invalid URL) — running without persistence');
    return null;
  }

  supabase = createClient(Settings.SUPABASE_URL, Settings.SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('✅ Supabase connected');
  return supabase;
}

/** Whether the service is configured (and thus available for persistence). */
export function isSupabaseConfigured(): boolean {
  return isConfigValid();
}

/**
 * Lightweight reachability probe for the health endpoint.
 * Returns true when the project answers on its REST endpoint.
 */
export async function pingSupabase(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const res = await fetch(`${Settings.SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: Settings.SUPABASE_SERVICE_KEY },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  is_admin: boolean;
  banned_until: string | null;
  created_at: string;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const db = getSupabase();
  if (!db) return null;

  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('Failed to find user:', error.message);
    return null;
  }
  return (data as UserRecord) || null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const db = getSupabase();
  if (!db) return null;

  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Failed to find user by id:', error.message);
    return null;
  }
  return (data as UserRecord) || null;
}

export async function createUser(input: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}): Promise<UserRecord | null> {
  const db = getSupabase();
  if (!db) return null;

  const { data, error } = await db
    .from('users')
    .insert({
      id: input.id,
      email: input.email,
      name: input.name,
      password_hash: input.passwordHash,
    })
    .select('*')
    .single();

  if (error) {
    // 23505 = unique_violation → user already exists
    if (error.code === '23505') {
      return findUserByEmail(input.email);
    }
    console.error('Failed to create user:', error.message);
    return null;
  }
  return data as UserRecord;
}

export async function updateUserPassword(userId: string, passwordHash: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  const { error } = await db
    .from('users')
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.error('Failed to update user password:', error.message);
    return false;
  }
  return true;
}

export async function setUserBanned(userId: string, banned: boolean): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  const { error } = await db
    .from('users')
    .update({ banned_until: banned ? new Date(Date.now() + 3650 * 24 * 3600 * 1000).toISOString() : null })
    .eq('id', userId);

  if (error) {
    console.error('Failed to update user ban status:', error.message);
    return false;
  }
  return true;
}

export async function listUsers(limit = 100): Promise<any[]> {
  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from('users')
    .select('id, email, name, is_admin, banned_until, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to list users:', error.message);
    return [];
  }
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversations
// ─────────────────────────────────────────────────────────────────────────────

export interface ConversationRecord {
  id: string;
  user_id: string;
  title: string;
  messages: any[];
  created_at: string;
  updated_at: string;
}

/** API-facing shape (camelCase) returned to routes/clients. */
export interface ConversationApiShape {
  id: string;
  title: string;
  messages: any[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

function toConversationShape(row: any): ConversationApiShape {
  return {
    id: row.id,
    title: row.title,
    messages: row.messages || [],
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createConversation(userId: string, title: string): Promise<ConversationApiShape | null> {
  const db = getSupabase();
  if (!db) return null;

  const { data, error } = await db
    .from('conversations')
    .insert({ user_id: userId, title, messages: [] })
    .select('*')
    .single();

  if (error) {
    console.error('Failed to create conversation:', error.message);
    return null;
  }
  return toConversationShape(data);
}

export async function listConversations(userId: string): Promise<ConversationApiShape[]> {
  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Failed to fetch conversations:', error.message);
    return [];
  }
  return (data || []).map(toConversationShape);
}

export async function getConversation(userId: string, id: string): Promise<ConversationApiShape | null> {
  const db = getSupabase();
  if (!db) return null;

  const { data, error } = await db
    .from('conversations')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch conversation:', error.message);
    return null;
  }
  return data ? toConversationShape(data) : null;
}

export async function addMessageToConversation(
  userId: string,
  convId: string,
  message: any
): Promise<ConversationApiShape | null> {
  const db = getSupabase();
  if (!db) return null;

  const current = await getConversation(userId, convId);
  if (!current) return null;

  const messages = [...(current.messages || []), message];
  const { data, error } = await db
    .from('conversations')
    .update({ messages })
    .eq('id', convId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    console.error('Failed to add message:', error.message);
    return null;
  }
  return toConversationShape(data);
}

export async function deleteConversationById(userId: string, id: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  const { error } = await db
    .from('conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to delete conversation:', error.message);
    return false;
  }
  return true;
}

/**
 * Replace a conversation's message list (and optionally its title) in one
 * owner-scoped update. Used by the conversation store for auto-save, message
 * capping, and rename. Returns the updated row or null.
 */
export async function updateConversationContent(
  userId: string,
  id: string,
  fields: { messages?: any[]; title?: string }
): Promise<ConversationApiShape | null> {
  const db = getSupabase();
  if (!db) return null;

  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  if (fields.messages !== undefined) update.messages = fields.messages;
  if (fields.title !== undefined) update.title = fields.title;

  const { data, error } = await db
    .from('conversations')
    .update(update)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    console.error('Failed to update conversation:', error.message);
    return null;
  }
  return toConversationShape(data);
}

// Legacy helpers (kept for backward compatibility)
export async function saveConversation(
  userId: string,
  title: string,
  messages: any[]
): Promise<string | null> {
  const db = getSupabase();
  if (!db) return null;

  const { data, error } = await db
    .from('conversations')
    .insert({
      user_id: userId,
      title,
      messages,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to save conversation:', error.message);
    return null;
  }
  return data.id;
}

export async function getConversations(userId: string): Promise<any[]> {
  return listConversations(userId);
}

export async function saveUserStats(userId: string, stats: Record<string, any>): Promise<void> {
  const db = getSupabase();
  if (!db) return;

  await db.from('user_stats').upsert({
    user_id: userId,
    ...stats,
    updated_at: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage, quotas & audit (API platform + admin)
// ─────────────────────────────────────────────────────────────────────────────

export async function recordUsage(entry: {
  userId?: string | null;
  apiKeyId?: string | null;
  endpoint: string;
  method?: string;
  model?: string;
  statusCode?: number;
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
}): Promise<void> {
  const db = getSupabase();
  if (!db) return;

  await db.from('usage_events').insert({
    user_id: entry.userId || null,
    api_key_id: entry.apiKeyId || null,
    endpoint: entry.endpoint,
    method: entry.method || 'POST',
    model: entry.model || null,
    status_code: entry.statusCode ?? null,
    latency_ms: entry.latencyMs ?? null,
    tokens_in: entry.tokensIn ?? 0,
    tokens_out: entry.tokensOut ?? 0,
    cost_usd: entry.costUsd ?? 0,
  });
}

export async function recordAudit(entry: {
  actorType: string;
  actorId?: string;
  action: string;
  resource?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const db = getSupabase();
  if (!db) return;

  await db.from('audit_logs').insert({
    actor_type: entry.actorType,
    actor_id: entry.actorId || null,
    action: entry.action,
    resource: entry.resource || null,
    ip: entry.ip || null,
    user_agent: entry.userAgent || null,
    metadata: entry.metadata || {},
  });
}

export async function createApiKey(input: {
  userId: string;
  name?: string;
  keyHash: string;
  keySuffix: string;
  scopes?: string[];
  quotaPerDay?: number;
}): Promise<any | null> {
  const db = getSupabase();
  if (!db) return null;

  const { data, error } = await db
    .from('api_keys')
    .insert({
      user_id: input.userId,
      name: input.name || 'Default Key',
      key_hash: input.keyHash,
      key_suffix: input.keySuffix,
      scopes: input.scopes || ['chat'],
      quota_per_day: input.quotaPerDay || 1000,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Failed to create API key:', error.message);
    return null;
  }
  return data;
}

export async function listApiKeys(userId: string): Promise<any[]> {
  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from('api_keys')
    .select('id, name, key_suffix, scopes, quota_per_day, requests_today, status, created_at, last_used_at, expires_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to list API keys:', error.message);
    return [];
  }
  return data || [];
}

export async function revokeApiKey(userId: string, id: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  const { error } = await db
    .from('api_keys')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to revoke API key:', error.message);
    return false;
  }
  return true;
}

export async function findApiKeyByHash(keyHash: string): Promise<any | null> {
  const db = getSupabase();
  if (!db) return null;

  const { data, error } = await db
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    console.error('Failed to find API key:', error.message);
    return null;
  }
  return data || null;
}

export async function recordApiKeyUsage(apiKeyId: string): Promise<void> {
  const db = getSupabase();
  if (!db) return;

  const { data: row } = await db
    .from('api_keys')
    .select('requests_today, quota_reset_at')
    .eq('id', apiKeyId)
    .maybeSingle();
  if (!row) return;

  const resetAt = row.quota_reset_at ? new Date(row.quota_reset_at).getTime() : 0;
  const rolledOver = Date.now() - resetAt > 24 * 3600 * 1000;
  const requestsToday = rolledOver ? 1 : (row.requests_today || 0) + 1;

  await db
    .from('api_keys')
    .update({
      requests_today: requestsToday,
      quota_reset_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    })
    .eq('id', apiKeyId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider credentials (user-supplied third-party AI API keys)
//
// The `encrypted_key` column stores AES-256-GCM ciphertext produced by
// providers/credentials.ts. Plaintext keys are NEVER persisted or returned.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderCredentialRow {
  id: string;
  user_id: string;
  provider: string;
  label: string;
  encrypted_key: string;
  base_url: string | null;
  model: string | null;
  capabilities: any;
  status: string;
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export async function createProviderCredential(input: {
  userId: string;
  provider: string;
  label: string;
  encryptedKey: string;
  baseUrl?: string;
  model?: string;
  capabilities?: Record<string, any>;
}): Promise<ProviderCredentialRow | null> {
  const db = getSupabase();
  if (!db) return null;

  const { data, error } = await db
    .from('provider_credentials')
    .insert({
      user_id: input.userId,
      provider: input.provider,
      label: input.label,
      encrypted_key: input.encryptedKey,
      base_url: input.baseUrl || null,
      model: input.model || null,
      capabilities: input.capabilities || {},
    })
    .select('*')
    .single();

  if (error) {
    console.error('Failed to create provider credential:', error.message);
    return null;
  }
  return data as ProviderCredentialRow;
}

export async function listProviderCredentials(userId: string): Promise<ProviderCredentialRow[]> {
  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from('provider_credentials')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to list provider credentials:', error.message);
    return [];
  }
  return (data || []) as ProviderCredentialRow[];
}

export async function getProviderCredential(userId: string, id: string): Promise<ProviderCredentialRow | null> {
  const db = getSupabase();
  if (!db) return null;

  const { data, error } = await db
    .from('provider_credentials')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch provider credential:', error.message);
    return null;
  }
  return (data as ProviderCredentialRow) || null;
}

export async function updateProviderCredential(
  userId: string,
  id: string,
  fields: {
    label?: string;
    model?: string;
    base_url?: string;
    capabilities?: Record<string, any>;
    status?: string;
    last_error?: string | null;
    last_checked_at?: string;
    encrypted_key?: string;
  }
): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  const { error } = await db
    .from('provider_credentials')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to update provider credential:', error.message);
    return false;
  }
  return true;
}

export async function deleteProviderCredential(userId: string, id: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  const { error } = await db.from('provider_credentials').delete().eq('id', id).eq('user_id', userId);

  if (error) {
    console.error('Failed to delete provider credential:', error.message);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Password resets
//
// Only the SHA-256 hash of the reset token is stored (never the token). Rows
// are single-use: consumed on success, expired via TTL, deleted on use.
// ─────────────────────────────────────────────────────────────────────────────

export interface PasswordResetRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export async function createPasswordReset(input: {
  userId: string;
  tokenHash: string;
  expiresAt: string;
  ip?: string;
  userAgent?: string;
}): Promise<PasswordResetRow | null> {
  const db = getSupabase();
  if (!db) return null;

  const { data, error } = await db
    .from('password_resets')
    .insert({
      user_id: input.userId,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt,
      ip: input.ip || null,
      user_agent: input.userAgent || null,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Failed to create password reset:', error.message);
    return null;
  }
  return (data as PasswordResetRow) || null;
}

/** Look up an unused, unexpired reset by token hash. */
export async function findActivePasswordReset(tokenHash: string): Promise<PasswordResetRow | null> {
  const db = getSupabase();
  if (!db) return null;

  const { data, error } = await db
    .from('password_resets')
    .select('*')
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error('Failed to find password reset:', error.message);
    return null;
  }
  return (data as PasswordResetRow) || null;
}

/** Mark a reset token consumed (single-use). */
export async function consumePasswordReset(id: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  const { error } = await db
    .from('password_resets')
    .update({ used_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Failed to consume password reset:', error.message);
    return false;
  }
  return true;
}

/** Remove all outstanding resets for a user (post-success hygiene). */
export async function revokePasswordResets(userId: string): Promise<void> {
  const db = getSupabase();
  if (!db) return;

  await db.from('password_resets').delete().eq('user_id', userId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Stripe webhook idempotency
// ─────────────────────────────────────────────────────────────────────────────

export async function hasStripeEvent(eventId: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  const { data, error } = await db.from('stripe_events').select('id').eq('id', eventId).maybeSingle();
  if (error) {
    console.error('Failed to check stripe event:', error.message);
    return false;
  }
  return Boolean(data);
}

export async function recordStripeEvent(eventId: string, type: string): Promise<void> {
  const db = getSupabase();
  if (!db) return;

  const { error } = await db.from('stripe_events').insert({ id: eventId, type });
  if (error && error.code !== '23505') {
    console.error('Failed to record stripe event:', error.message);
  }
}

/** The user's latest Stripe customer id (for the billing portal). */
export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const db = getSupabase();
  if (!db) return null;

  const { data, error } = await db
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .not('stripe_customer_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch stripe customer id:', error.message);
    return null;
  }
  return (data?.stripe_customer_id as string) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin queries
// ─────────────────────────────────────────────────────────────────────────────

export async function getUsageSummary(days = 7): Promise<any> {
  const db = getSupabase();
  if (!db) return { total: 0, byEndpoint: [], byDay: [], cost: 0 };

  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  const { data, error } = await db
    .from('usage_events')
    .select('endpoint, status_code, latency_ms, cost_usd, created_at')
    .gte('created_at', since)
    .limit(10000);

  if (error) {
    console.error('Failed to get usage summary:', error.message);
    return { total: 0, byEndpoint: [], byDay: [], cost: 0 };
  }

  const rows = data || [];
  const byEndpoint: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  let cost = 0;
  let totalLatency = 0;

  for (const row of rows) {
    byEndpoint[row.endpoint] = (byEndpoint[row.endpoint] || 0) + 1;
    const day = (row.created_at || '').slice(0, 10);
    if (day) byDay[day] = (byDay[day] || 0) + 1;
    cost += Number(row.cost_usd) || 0;
    totalLatency += Number(row.latency_ms) || 0;
  }

  return {
    total: rows.length,
    byEndpoint: Object.entries(byEndpoint).map(([endpoint, count]) => ({ endpoint, count })),
    byDay: Object.entries(byDay).map(([day, count]) => ({ day, count })),
    cost,
    avgLatencyMs: rows.length ? Math.round(totalLatency / rows.length) : 0,
  };
}

export async function getRecentAuditLogs(limit = 100): Promise<any[]> {
  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get audit logs:', error.message);
    return [];
  }
  return data || [];
}

export async function listAllConversations(limit = 200): Promise<ConversationApiShape[]> {
  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to list conversations:', error.message);
    return [];
  }
  return (data || []).map(toConversationShape);
}

export async function getAgentLogs(limit = 200): Promise<any[]> {
  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from('agent_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get agent logs:', error.message);
    return [];
  }
  return data || [];
}
