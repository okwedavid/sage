/**
 * services/api-keys.ts
 * OWNS: API key lifecycle — generation, hashing, storage, rotation, revocation.
 *
 * Security model:
 *  - Keys are 32 random bytes, base64url-encoded, prefixed `sk_sage_`.
 *  - Only the SHA-256 hash + last-8 suffix are stored (never the plaintext).
 *  - The plaintext key is returned exactly once at creation time.
 *
 * Persistence: Supabase `api_keys` table when configured; otherwise an
 * in-memory Map (local/demo runs). Both modes enforce quotas & status.
 */
import { createHash, randomBytes } from 'node:crypto';
import {
  isSupabaseConfigured,
  createApiKey as dbCreateKey,
  listApiKeys as dbListKeys,
  revokeApiKey as dbRevokeKey,
  findApiKeyByHash,
  recordApiKeyUsage as dbRecordUsage,
  recordAudit,
} from './supabase';

export interface ApiKeyRecord {
  id: string;
  userId: string;
  name: string;
  keyHash: string;
  keySuffix: string;
  scopes: string[];
  quotaPerDay: number;
  requestsToday: number;
  status: 'active' | 'revoked';
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

const KEY_PREFIX = 'sk_sage_';

export function generateKey(): string {
  return `${KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function keySuffix(key: string): string {
  return key.slice(-8);
}

export function isApiKeyFormat(value: string): boolean {
  return typeof value === 'string' && value.startsWith(KEY_PREFIX) && value.length > KEY_PREFIX.length + 16;
}

// ── In-memory fallback store ──
const memKeys = new Map<string, ApiKeyRecord>(); // by id

/**
 * Normalize a row into the API-facing record. Accepts BOTH the Supabase
 * snake_case row shape and the in-memory camelCase record shape, so the
 * same record type flows through both persistence paths.
 */
function toRecord(row: any): ApiKeyRecord {
  const isDbRow = 'user_id' in row;
  return {
    id: row.id,
    userId: isDbRow ? row.user_id : row.userId,
    name: row.name,
    keyHash: isDbRow ? row.key_hash : row.keyHash,
    keySuffix: isDbRow ? row.key_suffix : row.keySuffix,
    scopes: row.scopes || ['chat'],
    quotaPerDay: isDbRow ? row.quota_per_day : row.quotaPerDay,
    requestsToday: isDbRow ? row.requests_today || 0 : row.requestsToday || 0,
    status: row.status || 'active',
    createdAt: isDbRow ? row.created_at : row.createdAt,
    lastUsedAt: isDbRow ? row.last_used_at : row.lastUsedAt || null,
    expiresAt: isDbRow ? row.expires_at : row.expiresAt || null,
  };
}

/** Create a key; returns the record WITHOUT plaintext + the plaintext separately. */
export async function createKey(input: {
  userId: string;
  name?: string;
  scopes?: string[];
  quotaPerDay?: number;
  expiresAt?: string;
}): Promise<{ record: ApiKeyRecord; plaintext: string } | null> {
  const plaintext = generateKey();
  const payload = {
    userId: input.userId,
    name: input.name || 'Default Key',
    keyHash: hashKey(plaintext),
    keySuffix: keySuffix(plaintext),
    scopes: input.scopes || ['chat'],
    quotaPerDay: input.quotaPerDay || 1000,
    expiresAt: input.expiresAt || null,
  };

  if (isSupabaseConfigured()) {
    const row = await dbCreateKey({ ...payload, keyHash: payload.keyHash, keySuffix: payload.keySuffix });
    if (!row) return null;
    return { record: toRecord(row), plaintext };
  }

  const record: ApiKeyRecord = {
    id: randomBytes(16).toString('hex'),
    userId: payload.userId,
    name: payload.name,
    keyHash: payload.keyHash,
    keySuffix: payload.keySuffix,
    scopes: payload.scopes,
    quotaPerDay: payload.quotaPerDay,
    requestsToday: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    expiresAt: payload.expiresAt,
  };
  memKeys.set(record.id, record);
  return { record, plaintext };
}

export async function listKeys(userId: string): Promise<ApiKeyRecord[]> {
  if (isSupabaseConfigured()) {
    const rows = await dbListKeys(userId);
    return (rows || []).map(toRecord);
  }
  return Array.from(memKeys.values())
    .filter((k) => k.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function revokeKey(userId: string, keyId: string): Promise<boolean> {
  // Idempotent: a key that is missing or already revoked is a 404, not a 200.
  const existing = (await listKeys(userId)).find((k) => k.id === keyId);
  if (!existing || existing.status === 'revoked') return false;

  if (isSupabaseConfigured()) {
    const ok = await dbRevokeKey(userId, keyId);
    if (ok) {
      await recordAudit({ actorType: 'user', actorId: userId, action: 'api_key.revoked', resource: keyId });
    }
    return ok;
  }
  const record = memKeys.get(keyId);
  if (!record || record.userId !== userId) return false;
  record.status = 'revoked';
  return true;
}

/** Revoke the old key and mint a fresh one in its place (rotation). */
export async function rotateKey(
  userId: string,
  keyId: string,
  opts?: { name?: string; scopes?: string[]; quotaPerDay?: number }
): Promise<{ record: ApiKeyRecord; plaintext: string } | null> {
  const existing = (await listKeys(userId)).find((k) => k.id === keyId && k.status === 'active');
  if (!existing) return null;

  const ok = await revokeKey(userId, keyId);
  if (!ok) return null;

  const created = await createKey({
    userId,
    name: opts?.name || `${existing.name} (rotated)`,
    scopes: opts?.scopes || existing.scopes,
    quotaPerDay: opts?.quotaPerDay || existing.quotaPerDay,
  });

  if (created) {
    await recordAudit({ actorType: 'user', actorId: userId, action: 'api_key.rotated', resource: keyId });
  }
  return created;
}

/**
 * Authenticate a presented API key. Returns the record (with userId) or null.
 * Enforces: active status, expiry, and per-day quota (429 via `quotaExceeded`).
 */
export async function authenticateKey(
  rawKey: string
): Promise<{ record: ApiKeyRecord; quotaExceeded: boolean } | null> {
  if (!isApiKeyFormat(rawKey)) return null;
  const digest = hashKey(rawKey);

  let row: any = null;
  if (isSupabaseConfigured()) {
    row = await findApiKeyByHash(digest);
    if (!row) return null;
    await dbRecordUsage(row.id);
  } else {
    row = Array.from(memKeys.values()).find((k) => k.keyHash === digest) || null;
    if (!row) return null;
    row.requestsToday += 1;
    row.lastUsedAt = new Date().toISOString();
  }    if (row.status !== 'active') return null;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;
  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) return null;

  const record = toRecord(row);
  const quotaExceeded = record.requestsToday > record.quotaPerDay;
  return { record, quotaExceeded };
}

export function scopeAllows(record: ApiKeyRecord, required: string): boolean {
  return record.scopes.includes(required);
}
