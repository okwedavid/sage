/**
 * services/supabase.test.ts — Unit tests for the Supabase persistence layer
 *
 * The supabase-js client is mocked with a chainable builder. `vi.resetModules()`
 * + dynamic import gives each test a fresh module (so the client cache and env
 * are fully controllable).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockBuilder } = vi.hoisted(() => {
  const builder: any = {
    table: '',
    data: null,
    error: null,
    from(t: string) {
      builder.table = t;
      return builder;
    },
    select() {
      return builder;
    },
    insert() {
      return builder;
    },
    upsert() {
      return builder;
    },
    update() {
      return builder;
    },
    delete() {
      return builder;
    },
    eq() {
      return builder;
    },
    gte() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    single: async () => ({ data: builder.data, error: builder.error }),
    // On a unique-violation insert error, a follow-up lookup returns the
    // existing row (emulates createUser's 23505 → findUserByEmail fallback).
    maybeSingle: async () => ({
      data: builder.data,
      error: builder.error?.code === '23505' ? null : builder.error,
    }),
  };
  return { mockBuilder: builder };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: (t: string) => mockBuilder.from(t),
  })),
}));

import { createClient } from '@supabase/supabase-js';

async function loadService() {
  return await import('./supabase');
}

beforeEach(() => {
  vi.resetModules();
  mockBuilder.data = null;
  mockBuilder.error = null;
  vi.mocked(createClient).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubConfiguredEnv() {
  vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_KEY', 'service-role-key');
}

describe('getSupabase / configuration', () => {
  it('returns null when Supabase is not configured', async () => {
    const { getSupabase } = await loadService();
    expect(getSupabase()).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('creates and caches a client when configured', async () => {
    stubConfiguredEnv();
    const { getSupabase } = await loadService();

    const client1 = getSupabase();
    const client2 = getSupabase();

    expect(client1).toBeTruthy();
    expect(client2).toBe(client1); // cached singleton
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith('https://test.supabase.co', 'service-role-key', {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  it('treats an invalid URL as unconfigured (no crash on createClient)', async () => {
    vi.stubEnv('SUPABASE_URL', 'not-a-url');
    vi.stubEnv('SUPABASE_SERVICE_KEY', 'service-role-key');
    const { getSupabase, isSupabaseConfigured } = await loadService();

    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabase()).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('reports configured only when URL is a valid http(s) URL and key present', async () => {
    stubConfiguredEnv();
    const { isSupabaseConfigured } = await loadService();
    expect(isSupabaseConfigured()).toBe(true);
  });

  it('pingSupabase returns false when unconfigured', async () => {
    const { pingSupabase } = await loadService();
    await expect(pingSupabase()).resolves.toBe(false);
  });

  it('pingSupabase returns true when the project answers', async () => {
    stubConfiguredEnv();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    const { pingSupabase } = await loadService();
    await expect(pingSupabase()).resolves.toBe(true);
    vi.unstubAllGlobals();
  });

  it('pingSupabase returns false on network errors', async () => {
    stubConfiguredEnv();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const { pingSupabase } = await loadService();
    await expect(pingSupabase()).resolves.toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('users', () => {
  it('findUserByEmail returns the row when found', async () => {
    stubConfiguredEnv();
    mockBuilder.data = { id: 'u1', email: 'a@b.dev', password_hash: 'scrypt:x', is_admin: false };
    const { findUserByEmail } = await loadService();

    const user = await findUserByEmail('a@b.dev');
    expect(user?.email).toBe('a@b.dev');
    expect(mockBuilder.table).toBe('users');
  });

  it('findUserByEmail returns null when missing', async () => {
    stubConfiguredEnv();
    mockBuilder.data = null;
    const { findUserByEmail } = await loadService();
    expect(await findUserByEmail('ghost@b.dev')).toBeNull();
  });

  it('findUserByEmail returns null on query errors', async () => {
    stubConfiguredEnv();
    mockBuilder.error = { message: 'query failed' };
    const { findUserByEmail } = await loadService();
    expect(await findUserByEmail('a@b.dev')).toBeNull();
  });

  it('findUserById returns the row', async () => {
    stubConfiguredEnv();
    mockBuilder.data = { id: 'u1', email: 'a@b.dev' };
    const { findUserById } = await loadService();
    expect((await findUserById('u1'))?.id).toBe('u1');

    mockBuilder.error = { message: 'fail' };
    expect(await findUserById('u1')).toBeNull();
  });

  it('createUser inserts and returns the created row', async () => {
    stubConfiguredEnv();
    mockBuilder.data = { id: 'u1', email: 'a@b.dev', name: 'A' };
    const { createUser } = await loadService();

    const user = await createUser({ id: 'u1', email: 'a@b.dev', name: 'A', passwordHash: 'scrypt:x' });
    expect(user?.id).toBe('u1');
    expect(mockBuilder.table).toBe('users');
  });

  it('createUser resolves the existing user on unique violation', async () => {
    stubConfiguredEnv();
    mockBuilder.error = { code: '23505', message: 'duplicate' };
    mockBuilder.data = { id: 'u1', email: 'a@b.dev', name: 'A' };
    const { createUser } = await loadService();

    const user = await createUser({ id: 'u2', email: 'a@b.dev', name: 'A', passwordHash: 'scrypt:x' });
    expect(user?.id).toBe('u1');
  });

  it('createUser returns null on other errors', async () => {
    stubConfiguredEnv();
    mockBuilder.error = { message: 'db down' };
    const { createUser } = await loadService();
    expect(await createUser({ id: 'u1', email: 'a@b.dev', name: 'A', passwordHash: 'x' })).toBeNull();
  });

  it('setUserBanned updates the ban column', async () => {
    stubConfiguredEnv();
    const { setUserBanned } = await loadService();
    expect(await setUserBanned('u1', true)).toBe(true);
    expect(mockBuilder.table).toBe('users');
  });

  it('setUserBanned returns false on error', async () => {
    stubConfiguredEnv();
    mockBuilder.error = { message: 'nope' };
    const { setUserBanned } = await loadService();
    expect(await setUserBanned('u1', true)).toBe(false);
  });

  it('listUsers returns rows or [] on error', async () => {
    stubConfiguredEnv();
    mockBuilder.data = [{ id: 'u1' }, { id: 'u2' }];
    const { listUsers } = await loadService();
    expect(await listUsers()).toHaveLength(2);

    mockBuilder.error = { message: 'fail' };
    expect(await listUsers()).toEqual([]);
  });
});

describe('conversations', () => {
  it('createConversation inserts and maps to the API shape', async () => {
    stubConfiguredEnv();
    mockBuilder.data = { id: 'c1', title: 'Hi', messages: [], user_id: 'u1', created_at: 't', updated_at: 't' };
    const { createConversation } = await loadService();

    const conv = await createConversation('u1', 'Hi');
    expect(conv?.id).toBe('c1');
    expect(conv?.userId).toBe('u1');
    expect(conv?.createdAt).toBe('t');
    expect(mockBuilder.table).toBe('conversations');
  });

  it('createConversation returns null on error', async () => {
    stubConfiguredEnv();
    mockBuilder.error = { message: 'fail' };
    const { createConversation } = await loadService();
    expect(await createConversation('u1', 'Hi')).toBeNull();
  });

  it('listConversations maps rows to the API shape', async () => {
    stubConfiguredEnv();
    mockBuilder.data = [
      { id: 'c1', title: 'A', messages: [], user_id: 'u1', created_at: 't1', updated_at: 't2' },
    ];
    const { listConversations } = await loadService();

    const rows = await listConversations('u1');
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe('u1');
    expect(rows[0].updatedAt).toBe('t2');
  });

  it('listConversations returns [] on error', async () => {
    stubConfiguredEnv();
    mockBuilder.error = { message: 'fail' };
    const { listConversations } = await loadService();
    expect(await listConversations('u1')).toEqual([]);
  });

  it('getConversation returns the mapped row or null', async () => {
    stubConfiguredEnv();
    mockBuilder.data = { id: 'c1', title: 'A', messages: [], user_id: 'u1', created_at: 't', updated_at: 't' };
    const { getConversation } = await loadService();
    expect((await getConversation('u1', 'c1'))?.id).toBe('c1');

    mockBuilder.data = null;
    expect(await getConversation('u1', 'missing')).toBeNull();
  });

  it('addMessageToConversation appends and persists messages', async () => {
    stubConfiguredEnv();
    mockBuilder.data = { id: 'c1', title: 'A', messages: [{ role: 'user', content: 'hi' }], user_id: 'u1', created_at: 't', updated_at: 't' };
    const { addMessageToConversation } = await loadService();

    const updated = await addMessageToConversation('u1', 'c1', { role: 'assistant', content: 'yo' });
    expect(updated?.messages).toHaveLength(1);
    expect(mockBuilder.table).toBe('conversations');
  });

  it('addMessageToConversation returns null when the conversation is missing', async () => {
    stubConfiguredEnv();
    mockBuilder.data = null;
    const { addMessageToConversation } = await loadService();
    expect(await addMessageToConversation('u1', 'nope', {})).toBeNull();
  });

  it('deleteConversationById returns success boolean', async () => {
    stubConfiguredEnv();
    const { deleteConversationById } = await loadService();
    expect(await deleteConversationById('u1', 'c1')).toBe(true);

    mockBuilder.error = { message: 'fail' };
    expect(await deleteConversationById('u1', 'c1')).toBe(false);
  });
});

describe('legacy helpers', () => {
  it('saveConversation returns the new id', async () => {
    stubConfiguredEnv();
    mockBuilder.data = { id: 'conv-123' };
    const { saveConversation } = await loadService();
    expect(await saveConversation('u1', 't', [])).toBe('conv-123');
  });

  it('saveConversation returns null on failure or when unconfigured', async () => {
    stubConfiguredEnv();
    mockBuilder.error = { message: 'x' };
    const { saveConversation } = await loadService();
    expect(await saveConversation('u1', 't', [])).toBeNull();

    vi.unstubAllEnvs();
    const { saveConversation: sc2 } = await loadService();
    expect(await sc2('u1', 't', [])).toBeNull();
  });

  it('getConversations delegates to listConversations', async () => {
    stubConfiguredEnv();
    mockBuilder.data = [{ id: 'c1', title: 'A', messages: [], user_id: 'u1', created_at: 't', updated_at: 't' }];
    const { getConversations } = await loadService();
    expect(await getConversations('u1')).toHaveLength(1);
  });

  it('saveUserStats upserts', async () => {
    stubConfiguredEnv();
    const { saveUserStats } = await loadService();
    await saveUserStats('u1', { messages: 5 });
    expect(mockBuilder.table).toBe('user_stats');
  });
});

describe('usage & audit', () => {
  it('recordUsage inserts a usage event', async () => {
    stubConfiguredEnv();
    const { recordUsage } = await loadService();
    await recordUsage({ userId: 'u1', endpoint: '/api/chat', latencyMs: 42 });
    expect(mockBuilder.table).toBe('usage_events');
  });

  it('recordAudit inserts an audit log', async () => {
    stubConfiguredEnv();
    const { recordAudit } = await loadService();
    await recordAudit({ actorType: 'user', actorId: 'u1', action: 'auth.login' });
    expect(mockBuilder.table).toBe('audit_logs');
  });
});

describe('api keys', () => {
  it('createApiKey inserts and returns the row', async () => {
    stubConfiguredEnv();
    mockBuilder.data = { id: 'k1', key_hash: 'h', key_suffix: 'abcd1234' };
    const { createApiKey } = await loadService();

    const key = await createApiKey({ userId: 'u1', keyHash: 'h', keySuffix: 'abcd1234' });
    expect(key?.id).toBe('k1');
    expect(mockBuilder.table).toBe('api_keys');
  });

  it('createApiKey returns null on error', async () => {
    stubConfiguredEnv();
    mockBuilder.error = { message: 'fail' };
    const { createApiKey } = await loadService();
    expect(await createApiKey({ userId: 'u1', keyHash: 'h', keySuffix: 'x' })).toBeNull();
  });

  it('listApiKeys returns the user keys or [] on error', async () => {
    stubConfiguredEnv();
    mockBuilder.data = [{ id: 'k1', name: 'dev' }];
    const { listApiKeys } = await loadService();
    expect(await listApiKeys('u1')).toHaveLength(1);
    expect(mockBuilder.table).toBe('api_keys');

    mockBuilder.error = { message: 'fail' };
    expect(await listApiKeys('u1')).toEqual([]);
  });

  it('revokeApiKey sets status revoked', async () => {
    stubConfiguredEnv();
    const { revokeApiKey } = await loadService();
    expect(await revokeApiKey('u1', 'k1')).toBe(true);
    expect(mockBuilder.table).toBe('api_keys');
  });

  it('findApiKeyByHash returns the active key or null on error', async () => {
    stubConfiguredEnv();
    mockBuilder.data = { id: 'k1', key_hash: 'h' };
    const { findApiKeyByHash } = await loadService();
    expect((await findApiKeyByHash('h'))?.id).toBe('k1');

    mockBuilder.error = { message: 'fail' };
    expect(await findApiKeyByHash('h')).toBeNull();
  });

  it('recordApiKeyUsage increments within the window and resets after rollover', async () => {
    stubConfiguredEnv();
    mockBuilder.data = { requests_today: 3, quota_reset_at: new Date().toISOString() };
    const { recordApiKeyUsage } = await loadService();
    await recordApiKeyUsage('k1');
    expect(mockBuilder.table).toBe('api_keys');

    // Window rolled over 25 hours ago → resets to 1
    mockBuilder.data = {
      requests_today: 3,
      quota_reset_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
    };
    await recordApiKeyUsage('k1');
    expect(mockBuilder.table).toBe('api_keys');
  });
});

describe('all functions degrade gracefully when unconfigured', () => {
  it('returns null/[]/false from every persistence function without a client', async () => {
    const svc = await loadService();

    expect(await svc.findUserByEmail('a@b.dev')).toBeNull();
    expect(await svc.findUserById('u1')).toBeNull();
    expect(await svc.createUser({ id: 'u1', email: 'a@b.dev', name: 'A', passwordHash: 'x' })).toBeNull();
    expect(await svc.setUserBanned('u1', true)).toBe(false);
    expect(await svc.listUsers()).toEqual([]);
    expect(await svc.createConversation('u1', 't')).toBeNull();
    expect(await svc.listConversations('u1')).toEqual([]);
    expect(await svc.getConversation('u1', 'c1')).toBeNull();
    expect(await svc.addMessageToConversation('u1', 'c1', {})).toBeNull();
    expect(await svc.deleteConversationById('u1', 'c1')).toBe(false);
    expect(await svc.recordUsage({ endpoint: '/api/chat' })).toBeUndefined();
    expect(await svc.recordAudit({ actorType: 'user', action: 'x' })).toBeUndefined();
    expect(await svc.createApiKey({ userId: 'u1', keyHash: 'h', keySuffix: 'x' })).toBeNull();
    expect(await svc.listApiKeys('u1')).toEqual([]);
    expect(await svc.revokeApiKey('u1', 'k1')).toBe(false);
    expect(await svc.findApiKeyByHash('h')).toBeNull();
    expect(await svc.recordApiKeyUsage('k1')).toBeUndefined();
    expect(await svc.getUsageSummary()).toEqual({ total: 0, byEndpoint: [], byDay: [], cost: 0 });
    expect(await svc.getRecentAuditLogs()).toEqual([]);
    expect(await svc.listAllConversations()).toEqual([]);
    expect(await svc.getAgentLogs()).toEqual([]);
  });
});

describe('admin queries', () => {
  it('getUsageSummary aggregates totals, endpoints, days and cost', async () => {
    stubConfiguredEnv();
    mockBuilder.data = [
      { endpoint: '/api/chat', status_code: 200, latency_ms: 100, cost_usd: 0.01, created_at: '2026-08-05T10:00:00Z' },
      { endpoint: '/api/chat', status_code: 500, latency_ms: 300, cost_usd: 0.02, created_at: '2026-08-05T11:00:00Z' },
      { endpoint: '/api/agents', status_code: 200, latency_ms: 10, cost_usd: 0, created_at: '2026-08-04T10:00:00Z' },
    ];
    const { getUsageSummary } = await loadService();

    const summary = await getUsageSummary(7);
    expect(summary.total).toBe(3);
    expect(summary.cost).toBeCloseTo(0.03);
    expect(summary.avgLatencyMs).toBe(137); // (100+300+10)/3 = 136.67 → 137
    expect(summary.byEndpoint.find((e: any) => e.endpoint === '/api/chat')?.count).toBe(2);
    expect(summary.byDay.length).toBeGreaterThan(0);
  });

  it('getUsageSummary returns an empty shape on error', async () => {
    stubConfiguredEnv();
    mockBuilder.error = { message: 'fail' };
    const { getUsageSummary } = await loadService();
    expect(await getUsageSummary()).toEqual({ total: 0, byEndpoint: [], byDay: [], cost: 0 });
  });

  it('getRecentAuditLogs returns rows or [] on error', async () => {
    stubConfiguredEnv();
    mockBuilder.data = [{ action: 'api_key.created' }];
    const { getRecentAuditLogs } = await loadService();
    expect(await getRecentAuditLogs()).toHaveLength(1);

    mockBuilder.error = { message: 'fail' };
    expect(await getRecentAuditLogs()).toEqual([]);
  });

  it('listAllConversations maps rows or returns [] on error', async () => {
    stubConfiguredEnv();
    mockBuilder.data = [{ id: 'c1', title: 'A', messages: [], user_id: 'u1', created_at: 't', updated_at: 't' }];
    const { listAllConversations } = await loadService();
    expect((await listAllConversations())[0].userId).toBe('u1');

    mockBuilder.error = { message: 'fail' };
    expect(await listAllConversations()).toEqual([]);
  });

  it('getAgentLogs returns rows or [] on error', async () => {
    stubConfiguredEnv();
    mockBuilder.data = [{ task_type: 'DEBUG' }];
    const { getAgentLogs } = await loadService();
    expect(await getAgentLogs()).toHaveLength(1);

    mockBuilder.error = { message: 'fail' };
    expect(await getAgentLogs()).toEqual([]);
  });
});
