/**
 * routes/admin.test.ts — Admin endpoints (integration, in-memory fallback)
 *
 * Admin auth: with Supabase unconfigured, requireAdmin accepts an `isAdmin`
 * claim in the JWT (or ADMIN_EMAILS env). Tests sign tokens directly.
 */
import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { withServer, jsonFetch } from '../test-utils/http';

vi.hoisted(() => {
  process.env.GROQ_API_KEY = 'gsk_test_server_key';
  process.env.JWT_SECRET = 'test-secret-for-admin-routes';
});

import app from '../index';
import { Settings } from '../config/settings';

function adminToken(): string {
  return jwt.sign({ userId: 'admin-1', email: 'boss@sage.dev', isAdmin: true }, Settings.JWT_SECRET, {
    expiresIn: '1h',
  });
}

function userToken(): string {
  return jwt.sign({ userId: 'user-1', email: 'user@sage.dev' }, Settings.JWT_SECRET, { expiresIn: '1h' });
}

describe('admin guard', () => {
  it('returns 401 without a token', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/admin/summary`);
      expect(status).toBe(401);
    });
  });

  it('returns 403 for a non-admin token', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/admin/summary`, {
        headers: { Authorization: `Bearer ${userToken()}` },
      });
      expect(status).toBe(403);
    });
  });

  it('returns 401 for a garbage token', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/admin/summary`, {
        headers: { Authorization: 'Bearer nope' },
      });
      expect(status).toBe(401);
    });
  });
});

describe('GET /api/admin/summary', () => {
  it('returns health, requests, memory and usage sections', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/admin/summary`, {
        headers: { Authorization: `Bearer ${adminToken()}` },
      });
      expect(status).toBe(200);
      expect(typeof body.uptimeSec).toBe('number');
      expect(body.health.engine).toContain('SAGE v');
      expect(body.health.groq).toBe('ok');
      expect(body.usage.total).toBeGreaterThanOrEqual(0);
      expect(body.memory.rssMb).toBeGreaterThan(0);
      // persisted flag must be present (Supabase unconfigured in tests)
      expect(typeof body.persisted).toBe('boolean');
    });
  });
});

describe('GET /api/admin/users', () => {
  it('returns a users array', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${adminToken()}` },
      });
      expect(status).toBe(200);
      expect(Array.isArray(body.users)).toBe(true);
    });
  });
});

describe('POST /api/admin/users/:id/ban', () => {
  it('rejects a non-boolean banned field with 400', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/admin/users/xyz/ban`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken()}` },
        body: JSON.stringify({ banned: 'yes' }),
      });
      expect(status).toBe(400);
    });
  });

  it('returns 404 for unknown users (in-memory mode has no persistence)', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/admin/users/nope/ban`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken()}` },
        body: JSON.stringify({ banned: true }),
      });
      expect(status).toBe(404);
    });
  });
});

describe('GET /api/admin/conversations & /logs', () => {
  it('returns conversation and log arrays', async () => {
    await withServer(app, async (baseUrl) => {
      const headers = { Authorization: `Bearer ${adminToken()}` };

      const conv = await jsonFetch(`${baseUrl}/api/admin/conversations`, { headers });
      expect(conv.status).toBe(200);
      expect(Array.isArray(conv.body.conversations)).toBe(true);

      const logs = await jsonFetch(`${baseUrl}/api/admin/logs`, { headers });
      expect(logs.status).toBe(200);
      expect(Array.isArray(logs.body.audit)).toBe(true);
      expect(Array.isArray(logs.body.agent)).toBe(true);
    });
  });
});
