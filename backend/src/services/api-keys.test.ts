/**
 * services/api-keys.test.ts — API key lifecycle (in-memory fallback mode)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateKey,
  hashKey,
  keySuffix,
  isApiKeyFormat,
  createKey,
  listKeys,
  revokeKey,
  rotateKey,
  authenticateKey,
  scopeAllows,
} from './api-keys';

// All tests run against the in-memory store (Supabase env unset by default).
const USER = 'u-1';

describe('key material', () => {
  it('generates sk_sage_ prefixed keys of sufficient length', () => {
    const key = generateKey();
    expect(key.startsWith('sk_sage_')).toBe(true);
    expect(key.length).toBeGreaterThan(40);
  });

  it('hashes are stable, not reversible, and unique', () => {
    const k1 = generateKey();
    const k2 = generateKey();
    expect(hashKey(k1)).toBe(hashKey(k1));
    expect(hashKey(k1)).not.toBe(hashKey(k2));
    expect(hashKey(k1)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashKey(k1)).not.toContain(k1);
  });

  it('exposes only the last 8 chars as suffix', () => {
    const key = generateKey();
    expect(keySuffix(key)).toBe(key.slice(-8));
    expect(keySuffix(key)).not.toBe(key);
  });

  it('recognizes valid key formats and rejects junk', () => {
    expect(isApiKeyFormat(generateKey())).toBe(true);
    expect(isApiKeyFormat('sk_sage_short')).toBe(false);
    expect(isApiKeyFormat('gsk_abc123')).toBe(false);
    expect(isApiKeyFormat('')).toBe(false);
  });
});

describe('createKey', () => {
  beforeEach(() => {
    // Fresh store per test: keys accumulate in the module-level Map.
    // We don't have a reset API, so track ids and revoke between tests instead.
  });

  it('returns the plaintext exactly once and stores only a hash', async () => {
    const result = await createKey({ userId: USER, name: 'Prod' });
    expect(result).toBeTruthy();
    if (!result) return;

    const { record, plaintext } = result;
    expect(plaintext.startsWith('sk_sage_')).toBe(true);
    expect(record.keyHash).toBe(hashKey(plaintext));
    expect(record.keySuffix).toBe(keySuffix(plaintext));
    expect(record.status).toBe('active');
    expect(record.scopes).toEqual(['chat']);
    expect(record.quotaPerDay).toBe(1000);

    // The raw key is never stored anywhere queryable.
    const keys = await listKeys(USER);
    const stored = keys.find((k) => k.id === record.id);
    expect(stored).toBeTruthy();
    expect(JSON.stringify(stored)).not.toContain(plaintext);
  });

  it('honors custom scopes, quota, and expiry', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const result = await createKey({
      userId: USER,
      name: 'Chat only',
      scopes: ['chat', 'conversations'],
      quotaPerDay: 42,
      expiresAt: future,
    });
    expect(result?.record.scopes).toEqual(['chat', 'conversations']);
    expect(result?.record.quotaPerDay).toBe(42);
    expect(result?.record.expiresAt).toBe(future);
  });
});

describe('listKeys / revokeKey', () => {
  it('lists only keys belonging to the user', async () => {
    await createKey({ userId: USER, name: 'Mine' });
    await createKey({ userId: 'other-user', name: 'Not mine' });

    const mine = await listKeys(USER);
    expect(mine.some((k) => k.name === 'Mine')).toBe(true);
    expect(mine.some((k) => k.name === 'Not mine')).toBe(false);
  });

  it('revokes a key and rejects cross-user revocation', async () => {
    const mine = await createKey({ userId: USER });
    const theirs = await createKey({ userId: 'other-user' });
    if (!mine || !theirs) return;

    expect(await revokeKey(USER, theirs.record.id)).toBe(false); // not yours
    expect(await revokeKey('other-user', theirs.record.id)).toBe(true);
    expect(await revokeKey(USER, mine.record.id)).toBe(true);

    const keys = await listKeys(USER);
    expect(keys.find((k) => k.id === mine.record.id)?.status).toBe('revoked');
  });
});

describe('rotateKey', () => {
  it('revokes the old key and issues a fresh one with the same settings', async () => {
    const original = await createKey({ userId: USER, name: 'Staging', scopes: ['chat'], quotaPerDay: 500 });
    if (!original) return;

    const rotated = await rotateKey(USER, original.record.id, { name: 'Staging v2' });
    expect(rotated).toBeTruthy();
    if (!rotated) return;

    expect(rotated.plaintext).not.toBe(original.plaintext);
    expect(rotated.record.keyHash).not.toBe(original.record.keyHash);
    expect(rotated.record.scopes).toEqual(['chat']);
    expect(rotated.record.quotaPerDay).toBe(500);
    expect(rotated.record.name).toBe('Staging v2');

    // Old key no longer authenticates.
    expect(await authenticateKey(original.plaintext)).toBeNull();
    // New key does.
    expect(await authenticateKey(rotated.plaintext)).not.toBeNull();
  });

  it('returns null when rotating a missing or revoked key', async () => {
    expect(await rotateKey(USER, 'does-not-exist')).toBeNull();

    const created = await createKey({ userId: USER });
    if (!created) return;
    await revokeKey(USER, created.record.id);
    expect(await rotateKey(USER, created.record.id)).toBeNull();
  });
});

describe('authenticateKey', () => {
  it('authenticates a valid key and increments usage', async () => {
    const created = await createKey({ userId: USER, quotaPerDay: 5 });
    if (!created) return;

    const auth = await authenticateKey(created.plaintext);
    expect(auth).toBeTruthy();
    expect(auth?.record.userId).toBe(USER);
    expect(auth?.record.requestsToday).toBeGreaterThan(0);
    expect(auth?.quotaExceeded).toBe(false);
  });

  it('rejects unknown, revoked, and malformed keys', async () => {
    const created = await createKey({ userId: USER });
    if (!created) return;

    expect(await authenticateKey('sk_sage_' + 'a'.repeat(40))).toBeNull();

    await revokeKey(USER, created.record.id);
    expect(await authenticateKey(created.plaintext)).toBeNull();
    expect(await authenticateKey('not-a-key')).toBeNull();
  });

  it('flags quota exceeded once requests pass the daily limit', async () => {
    const created = await createKey({ userId: USER, quotaPerDay: 2 });
    if (!created) return;

    await authenticateKey(created.plaintext); // 1
    await authenticateKey(created.plaintext); // 2
    const third = await authenticateKey(created.plaintext); // 3 > 2
    expect(third?.quotaExceeded).toBe(true);
  });

  it('rejects an expired key', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const created = await createKey({ userId: USER, expiresAt: past });
    if (!created) return;

    expect(await authenticateKey(created.plaintext)).toBeNull();
  });
});

describe('scopeAllows', () => {
  it('checks membership', async () => {
    const created = await createKey({ userId: USER, scopes: ['chat'] });
    if (!created) return;
    expect(scopeAllows(created.record, 'chat')).toBe(true);
    expect(scopeAllows(created.record, 'admin')).toBe(false);
  });
});
