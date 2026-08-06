/**
 * routes/auth.test.ts — Integration tests for auth endpoints
 *
 * Passwords are stored hashed (scrypt) — tests exercise the public API and
 * assert credentials behave correctly without ever inspecting stored hashes.
 */
import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { withServer, jsonFetch } from '../test-utils/http';

vi.hoisted(() => {
  process.env.GROQ_API_KEY = 'gsk_test_server_key';
  process.env.JWT_SECRET = 'test-secret-for-auth-tests';
});

import app from '../index';
import { Settings } from '../config/settings';

describe('POST /api/auth/register', () => {
  it('creates a user and returns a token', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ email: 'new@user.dev', password: 'hunter2', name: 'New User' }),
      });

      expect(status).toBe(201);
      expect(body.token).toBeTruthy();
      expect(body.user.email).toBe('new@user.dev');
      expect(body.user.name).toBe('New User');
      const decoded = jwt.verify(body.token, Settings.JWT_SECRET) as any;
      expect(decoded.userId).toBe(body.user.id);
    });
  });

  it('defaults the name from the email when omitted', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ email: 'nameless@user.dev', password: 'pw123456' }),
      });
      expect(status).toBe(201);
      expect(body.user.name).toBe('nameless');
    });
  });

  it('rejects missing credentials', async () => {
    await withServer(app, async (baseUrl) => {
      const noEmail = await jsonFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ password: 'x' }),
      });
      expect(noEmail.status).toBe(400);
      expect(noEmail.body.error).toBe('Email and password required');
    });
  });

  it('rejects passwords shorter than 6 characters', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ email: 'short@user.dev', password: 'abc' }),
      });
      expect(status).toBe(400);
      expect(body.error).toBe('Password must be at least 6 characters');
    });
  });

  it('rejects duplicate emails with 409', async () => {
    await withServer(app, async (baseUrl) => {
      const first = await jsonFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ email: 'dup@user.dev', password: 'pw123456' }),
      });
      expect(first.status).toBe(201);

      const second = await jsonFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ email: 'dup@user.dev', password: 'otherpw' }),
      });
      expect(second.status).toBe(409);
      expect(second.body.error).toBe('User already exists');
    });
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    await withServer(app, async (baseUrl) => {
      await jsonFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ email: 'login@user.dev', password: 'correct-pw' }),
      });

      const { status, body } = await jsonFetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: 'login@user.dev', password: 'correct-pw' }),
      });

      expect(status).toBe(200);
      expect(body.token).toBeTruthy();
      expect(body.user.email).toBe('login@user.dev');
    });
  });

  it('rejects a wrong password', async () => {
    await withServer(app, async (baseUrl) => {
      await jsonFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ email: 'wrongpw@user.dev', password: 'right-pw' }),
      });

      const { status, body } = await jsonFetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: 'wrongpw@user.dev', password: 'wrong-pw' }),
      });

      expect(status).toBe(401);
      expect(body.error).toBe('Invalid credentials');
    });
  });

  it('rejects unknown emails', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: 'ghost@user.dev', password: 'whatever' }),
      });
      expect(status).toBe(401);
    });
  });
});

describe('POST /api/auth/demo', () => {
  it('issues a short-lived demo token', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/auth/demo`, { method: 'POST' });

      expect(status).toBe(200);
      expect(body.user.name).toBe('SAGE Explorer');
      const decoded = jwt.verify(body.token, Settings.JWT_SECRET) as any;
      expect(decoded.email).toBe('demo@sage.ai');
      // 24h expiry
      expect(decoded.exp - decoded.iat).toBe(24 * 60 * 60);
    });
  });
});
