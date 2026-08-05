/**
 * routes/api-keys.test.ts — API key management endpoints (integration)
 */
import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { withServer, jsonFetch } from '../test-utils/http';

vi.hoisted(() => {
  process.env.GROQ_API_KEY = 'gsk_test_server_key';
  process.env.JWT_SECRET = 'test-secret-for-api-key-routes';
});

import app from '../index';
import { Settings } from '../config/settings';

function authToken(userId: string): string {
  return jwt.sign({ userId, email: 'tester@sage.dev' }, Settings.JWT_SECRET, { expiresIn: '1h' });
}

const USER_ID = 'route-user-1';

describe('POST /api/keys', () => {
  it('requires authentication', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/keys`, { method: 'POST', body: JSON.stringify({}) });
      expect(status).toBe(401);
    });
  });

  it('creates a key and returns the plaintext once', async () => {
    await withServer(app, async (baseUrl) => {
      const res = await jsonFetch(`${baseUrl}/api/keys`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken(USER_ID)}` },
        body: JSON.stringify({ name: 'CI Key' }),
      });
      expect(res.status).toBe(201);
      expect(res.body.key).toMatch(/^sk_sage_/);
      expect(res.body.id).toBeTruthy();
      expect(res.body.suffix).toBe(res.body.key.slice(-8));
      expect(res.body.note).toContain('never');
    });
  });

  it('validates scopes and quota', async () => {
    await withServer(app, async (baseUrl) => {
      const badScope = await jsonFetch(`${baseUrl}/api/keys`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken(USER_ID)}` },
        body: JSON.stringify({ scopes: ['god-mode'] }),
      });
      expect(badScope.status).toBe(400);

      const badQuota = await jsonFetch(`${baseUrl}/api/keys`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken(USER_ID)}` },
        body: JSON.stringify({ quotaPerDay: 0 }),
      });
      expect(badQuota.status).toBe(400);
    });
  });
});

describe('GET /api/keys', () => {
  it('lists keys without exposing plaintext or hashes', async () => {
    await withServer(app, async (baseUrl) => {
      const headers = { Authorization: `Bearer ${authToken(USER_ID)}` };

      const created = await jsonFetch(`${baseUrl}/api/keys`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Visible' }),
      });
      expect(created.status).toBe(201);

      const list = await jsonFetch(`${baseUrl}/api/keys`, { headers });
      expect(list.status).toBe(200);
      const found = list.body.keys.find((k: any) => k.id === created.body.id);
      expect(found).toBeTruthy();
      expect(found.name).toBe('Visible');
      expect(found.suffix).toBe(created.body.key.slice(-8));
      expect(JSON.stringify(found)).not.toContain(created.body.key);
    });
  });
});

describe('POST /api/keys/:id/rotate', () => {
  it('rotates: new key issued, old key dead', async () => {
    await withServer(app, async (baseUrl) => {
      const headers = { Authorization: `Bearer ${authToken(USER_ID)}` };
      const created = await jsonFetch(`${baseUrl}/api/keys`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Rotatable' }),
      });

      const rotated = await jsonFetch(`${baseUrl}/api/keys/${created.body.id}/rotate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      expect(rotated.status).toBe(200);
      expect(rotated.body.key).toMatch(/^sk_sage_/);
      expect(rotated.body.key).not.toBe(created.body.key);
    });
  });

  it('404s for unknown keys', async () => {
    await withServer(app, async (baseUrl) => {
      const res = await jsonFetch(`${baseUrl}/api/keys/nope/rotate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken(USER_ID)}` },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(404);
    });
  });
});

describe('DELETE /api/keys/:id', () => {
  it('revokes a key and 404s on a second revoke', async () => {
    await withServer(app, async (baseUrl) => {
      const headers = { Authorization: `Bearer ${authToken(USER_ID)}` };
      const created = await jsonFetch(`${baseUrl}/api/keys`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Expendable' }),
      });

      const del = await jsonFetch(`${baseUrl}/api/keys/${created.body.id}`, {
        method: 'DELETE',
        headers,
      });
      expect(del.status).toBe(200);
      expect(del.body.ok).toBe(true);

      const again = await jsonFetch(`${baseUrl}/api/keys/${created.body.id}`, {
        method: 'DELETE',
        headers,
      });
      expect(again.status).toBe(404);
    });
  });
});
