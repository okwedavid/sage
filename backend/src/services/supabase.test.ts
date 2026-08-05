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
    eq() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    single: async () => ({ data: builder.data, error: builder.error }),
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
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubConfiguredEnv() {
  vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_KEY', 'service-role-key');
}

describe('getSupabase', () => {
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
});

describe('saveConversation', () => {
  it('saves a conversation and returns its id', async () => {
    stubConfiguredEnv();
    mockBuilder.data = { id: 'conv-123' };
    const { saveConversation } = await loadService();

    const id = await saveConversation('u1', 'My title', [{ role: 'user', content: 'hi' }]);

    expect(id).toBe('conv-123');
    expect(mockBuilder.table).toBe('conversations');
  });

  it('returns null when the insert fails', async () => {
    stubConfiguredEnv();
    mockBuilder.error = { message: 'insert failed' };
    const { saveConversation } = await loadService();

    const id = await saveConversation('u1', 'title', []);

    expect(id).toBeNull();
  });

  it('returns null when Supabase is not configured', async () => {
    const { saveConversation } = await loadService();
    expect(await saveConversation('u1', 'title', [])).toBeNull();
  });
});

describe('getConversations', () => {
  it('returns the user rows ordered by recency', async () => {
    stubConfiguredEnv();
    mockBuilder.data = [{ id: 'c1' }, { id: 'c2' }];
    const { getConversations } = await loadService();

    const rows = await getConversations('u1');

    expect(rows).toHaveLength(2);
    expect(mockBuilder.table).toBe('conversations');
  });

  it('returns [] on query errors', async () => {
    stubConfiguredEnv();
    mockBuilder.error = { message: 'query failed' };
    const { getConversations } = await loadService();

    expect(await getConversations('u1')).toEqual([]);
  });

  it('returns [] when Supabase is not configured', async () => {
    const { getConversations } = await loadService();
    expect(await getConversations('u1')).toEqual([]);
  });
});

describe('saveUserStats', () => {
  it('upserts stats into user_stats', async () => {
    stubConfiguredEnv();
    const { saveUserStats } = await loadService();

    await saveUserStats('u1', { messages: 5 });

    expect(mockBuilder.table).toBe('user_stats');
    expect(mockBuilder.data).toBeNull(); // no error thrown
  });

  it('silently no-ops when Supabase is not configured', async () => {
    const { saveUserStats } = await loadService();
    await expect(saveUserStats('u1', {})).resolves.toBeUndefined();
  });
});
