/**
 * routes/auth.supabase.test.ts — Auth routes with Supabase persistence
 *
 * Mocks the services/supabase module so the routes exercise the DB-backed
 * code path (register → createUser, login → findUserByEmail + scrypt verify,
 * banned accounts → 403, /me resolution).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withServer, jsonFetch } from '../test-utils/http';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    configured: true,
    createUser: vi.fn(),
    findUserByEmail: vi.fn(),
    findUserById: vi.fn(),
    recordAudit: vi.fn(async () => {}),
  },
}));

vi.mock('../services/supabase', () => ({
  isSupabaseConfigured: () => mockSupabase.configured,
  createUser: (...args: any[]) => mockSupabase.createUser(...args),
  findUserByEmail: (...args: any[]) => mockSupabase.findUserByEmail(...args),
  findUserById: (...args: any[]) => mockSupabase.findUserById(...args),
  recordAudit: (...args: any[]) => mockSupabase.recordAudit(...args),
}));

vi.hoisted(() => {
  process.env.GROQ_API_KEY = 'gsk_test_server_key';
  process.env.JWT_SECRET = 'test-secret-for-auth-supabase-tests';
});

import app from '../index';
import jwt from 'jsonwebtoken';
import { Settings } from '../config/settings';

beforeEach(() => {
  mockSupabase.configured = true;
  mockSupabase.createUser.mockReset();
  mockSupabase.findUserByEmail.mockReset();
  mockSupabase.findUserById.mockReset();
  mockSupabase.recordAudit.mockClear();
});

describe('register with Supabase', () => {
  it('persists the user and returns a token', async () => {
    mockSupabase.createUser.mockResolvedValue({ id: 'db-1', email: 'db@user.dev', name: 'DB User' });

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ email: 'db@user.dev', password: 'hunter22', name: 'DB User' }),
      });

      expect(status).toBe(201);
      expect(mockSupabase.createUser).toHaveBeenCalledTimes(1);
      // password must reach the service hashed (never plaintext)
      const arg = mockSupabase.createUser.mock.calls[0][0];
      expect(arg.passwordHash).toMatch(/^scrypt:/);
      expect(arg.email).toBe('db@user.dev');
      expect(body.token).toBeTruthy();
    });
  });

  it('rejects with 409 when the email already exists', async () => {
    mockSupabase.findUserByEmail.mockResolvedValue({ id: 'db-1', email: 'dup@user.dev' });

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ email: 'dup@user.dev', password: 'hunter22' }),
      });
      expect(status).toBe(409);
      expect(body.error).toBe('User already exists');
      expect(mockSupabase.createUser).not.toHaveBeenCalled();
    });
  });

  it('returns 500 when the DB insert fails', async () => {
    mockSupabase.createUser.mockResolvedValue(null);

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ email: 'fail@user.dev', password: 'hunter22' }),
      });
      expect(status).toBe(500);
      expect(body.error).toBe('Registration failed');
    });
  });

  it('rejects invalid emails with 400', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ email: 'not-an-email', password: 'hunter22' }),
      });
      expect(status).toBe(400);
    });
  });
});

describe('login with Supabase', () => {
  it('logs in a persisted user with a matching password hash', async () => {
    // Register (captures the scrypt hash), then log in against the DB record.
    let storedHash = '';
    let registered = false;
    mockSupabase.createUser.mockImplementation(async (input: any) => {
      storedHash = input.passwordHash;
      registered = true;
      return { id: input.id, email: input.email, name: input.name };
    });
    mockSupabase.findUserByEmail.mockImplementation(async () =>
      registered
        ? { id: 'db-1', email: 'db@user.dev', name: 'DB', password_hash: storedHash, is_admin: false, banned_until: null }
        : null
    );

    await withServer(app, async (baseUrl) => {
      await jsonFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ email: 'db@user.dev', password: 'correct-pw' }),
      });

      const { status, body } = await jsonFetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: 'db@user.dev', password: 'correct-pw' }),
      });
      expect(status).toBe(200);
      expect(body.user.isAdmin).toBe(false);
      expect(mockSupabase.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.login' })
      );
    });
  });

  it('rejects a wrong password', async () => {
    mockSupabase.findUserByEmail.mockResolvedValue({
      id: 'db-1',
      email: 'a@b.dev',
      name: 'A',
      password_hash: 'scrypt:00:00', // hash of nothing — will not match
      is_admin: false,
      banned_until: null,
    });

    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.dev', password: 'whatever' }),
      });
      expect(status).toBe(401);
    });
  });

  it('rejects unknown emails', async () => {
    mockSupabase.findUserByEmail.mockResolvedValue(null);
    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: 'ghost@b.dev', password: 'x' }),
      });
      expect(status).toBe(401);
    });
  });

  it('blocks suspended accounts with 403', async () => {
    // Credentials must be VALID to reach the ban check (the handler verifies
    // the password first, by design). Build a real scrypt hash for 'pw-123'.
    const { scrypt: scryptCb, randomBytes } = await import('node:crypto');
    const { promisify } = await import('node:util');
    const scrypt = promisify(scryptCb) as any;
    const salt = randomBytes(16);
    const hash = await scrypt('pw-123', salt, 64);

    mockSupabase.findUserByEmail.mockResolvedValue({
      id: 'db-1',
      email: 'banned@b.dev',
      name: 'B',
      password_hash: `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`,
      is_admin: false,
      banned_until: new Date(Date.now() + 86400000).toISOString(),
    });

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: 'banned@b.dev', password: 'pw-123' }),
      });
      expect(status).toBe(403);
      expect(body.error).toContain('suspended');
    });
  });
});

describe('GET /api/auth/me', () => {
  it('resolves the token to a persisted user with admin flag', async () => {
    mockSupabase.findUserById.mockResolvedValue({
      id: 'db-admin',
      email: 'admin@b.dev',
      name: 'Admin',
      is_admin: true,
    });

    const token = jwt.sign({ userId: 'db-admin', email: 'admin@b.dev' }, Settings.JWT_SECRET);

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(status).toBe(200);
      expect(body.user.isAdmin).toBe(true);
    });
  });

  it('returns 401 for an invalid token', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: 'Bearer garbage' },
      });
      expect(status).toBe(401);
    });
  });

  it('returns 404 when the user no longer exists', async () => {
    mockSupabase.findUserById.mockResolvedValue(null);
    const token = jwt.sign({ userId: 'gone', email: 'gone@b.dev' }, Settings.JWT_SECRET);

    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(status).toBe(404);
    });
  });
});
