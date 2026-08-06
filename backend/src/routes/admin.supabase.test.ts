/**
 * routes/admin.supabase.test.ts — Admin endpoints against mocked Supabase.
 * Exercises the DB-backed branches of the admin routes (persisted users,
 * usage, bans, conversations, logs).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { withServer, jsonFetch } from '../test-utils/http';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    configured: true,
    pingOk: true,
    listUsers: vi.fn(),
    setUserBanned: vi.fn(),
    getUsageSummary: vi.fn(),
    getRecentAuditLogs: vi.fn(),
    listAllConversations: vi.fn(),
    getAgentLogs: vi.fn(),
    recordAudit: vi.fn(),
    findUserById: vi.fn(),
  },
}));

vi.mock('../services/supabase', () => ({
  isSupabaseConfigured: () => mockSupabase.configured,
  pingSupabase: async () => mockSupabase.pingOk,
  listUsers: (...a: any[]) => mockSupabase.listUsers(...a),
  setUserBanned: (...a: any[]) => mockSupabase.setUserBanned(...a),
  getUsageSummary: (...a: any[]) => mockSupabase.getUsageSummary(...a),
  getRecentAuditLogs: (...a: any[]) => mockSupabase.getRecentAuditLogs(...a),
  listAllConversations: (...a: any[]) => mockSupabase.listAllConversations(...a),
  getAgentLogs: (...a: any[]) => mockSupabase.getAgentLogs(...a),
  recordAudit: (...a: any[]) => mockSupabase.recordAudit(...a),
  findUserById: (...a: any[]) => mockSupabase.findUserById(...a),
}));

vi.hoisted(() => {
  process.env.GROQ_API_KEY = 'gsk_test_server_key';
  process.env.JWT_SECRET = 'test-secret-for-admin-supabase';
});

import app from '../index';
import { Settings } from '../config/settings';

const adminToken = jwt.sign({ userId: 'admin-1', email: 'boss@sage.dev' }, Settings.JWT_SECRET, { expiresIn: '1h' });
const headers = { Authorization: `Bearer ${adminToken}` };

beforeEach(() => {
  mockSupabase.configured = true;
  mockSupabase.pingOk = true;
  // The admin token resolves to an admin in Supabase mode (requireAdmin check).
  mockSupabase.findUserById.mockResolvedValue({ id: 'admin-1', email: 'boss@sage.dev', is_admin: true });
  for (const fn of Object.values(mockSupabase)) {
    if (typeof fn === 'function') fn.mockClear();
  }
});

describe('admin summary (Supabase mode)', () => {
  it('reports persisted usage, users, and healthy dependencies', async () => {
    mockSupabase.listUsers.mockResolvedValue([
      { id: 'u1', is_admin: true, banned_until: null },
      { id: 'u2', is_admin: false, banned_until: '2030-01-01T00:00:00Z' },
    ]);
    mockSupabase.getUsageSummary.mockResolvedValue({
      total: 42,
      byEndpoint: [{ endpoint: '/api/chat', count: 40 }],
      byDay: [{ day: '2026-08-05', count: 42 }],
      cost: 0.12,
      avgLatencyMs: 900,
    });

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/admin/summary`, { headers });
      expect(status).toBe(200);
      expect(body.persisted).toBe(true);
      expect(body.users.total).toBe(2);
      expect(body.users.admins).toBe(1);
      expect(body.users.banned).toBe(1);
      expect(body.usage.total).toBe(42);
      expect(body.usage.costUsd).toBe(0.12);
      expect(body.health.supabase).toBe('ok');
      expect(body.workers).toBeDefined();
    });
  });

  it('reports unreachable Supabase when the ping fails', async () => {
    mockSupabase.listUsers.mockResolvedValue([]);
    mockSupabase.getUsageSummary.mockResolvedValue({ total: 0, byEndpoint: [], byDay: [], cost: 0, avgLatencyMs: 0 });
    mockSupabase.pingOk = false;

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/admin/summary`, { headers });
      expect(status).toBe(200);
      expect(body.health.supabase).toBe('unreachable');
    });
  });
});

describe('admin users (Supabase mode)', () => {
  it('maps persisted user rows to the API shape', async () => {
    mockSupabase.listUsers.mockResolvedValue([
      { id: 'u1', email: 'a@s.io', name: 'A', is_admin: true, banned_until: null, created_at: 't' },
    ]);

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/admin/users`, { headers });
      expect(status).toBe(200);
      expect(body.persisted).toBe(true);
      expect(body.users[0]).toMatchObject({ id: 'u1', email: 'a@s.io', isAdmin: true, banned: false });
    });
  });
});

describe('admin ban (Supabase mode)', () => {
  it('bans a user and records the audit trail', async () => {
    mockSupabase.setUserBanned.mockResolvedValue(true);

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/admin/users/u1/ban`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ banned: true }),
      });
      expect(status).toBe(200);
      expect(body.banned).toBe(true);
      expect(mockSupabase.setUserBanned).toHaveBeenCalledWith('u1', true);
      expect(mockSupabase.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.user_banned' }));
    });
  });

  it('returns 404 when the persistence layer cannot update', async () => {
    mockSupabase.setUserBanned.mockResolvedValue(false);

    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/admin/users/ghost/ban`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ banned: false }),
      });
      expect(status).toBe(404);
    });
  });
});

describe('admin conversations & logs (Supabase mode)', () => {
  it('maps persisted conversations with message counts', async () => {
    mockSupabase.listAllConversations.mockResolvedValue([
      { id: 'c1', title: 'Hi', userId: 'u1', messages: [{}, {}], createdAt: 't', updatedAt: 't' },
    ]);

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/admin/conversations`, { headers });
      expect(status).toBe(200);
      expect(body.conversations[0].messageCount).toBe(2);
    });
  });

  it('maps persisted audit + agent logs', async () => {
    mockSupabase.getRecentAuditLogs.mockResolvedValue([
      { id: 'a1', actor_type: 'user', actor_id: 'u1', action: 'auth.login', resource: 'x', ip: '1.2.3.4', created_at: 't', metadata: {} },
    ]);
    mockSupabase.getAgentLogs.mockResolvedValue([
      { id: 'l1', agent: 'GeneralWorker', status: 'ok', detail: 'done', duration_ms: 10, created_at: 't' },
    ]);

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/admin/logs`, { headers });
      expect(status).toBe(200);
      expect(body.audit[0].action).toBe('auth.login');
      expect(body.agent[0].agent).toBe('GeneralWorker');
      expect(body.agent[0].durationMs).toBe(10);
    });
  });
});
