/**
 * routes/auth-password-reset.test.ts — Integration tests for the password
 * reset flow (forgot-password → token → reset-password → login).
 *
 * Runs in-memory (no Supabase) in dev mode, so the reset link is returned as
 * `devResetUrl` — exactly how local development works without an email
 * provider. Security properties asserted: no user enumeration, single-use
 * tokens, invalid/expired token rejection, new password usable, old password
 * rejected.
 */
import { describe, it, expect, vi } from 'vitest';
import { withServer, jsonFetch } from '../test-utils/http';

vi.hoisted(() => {
  process.env.GROQ_API_KEY = 'gsk_test_server_key';
  process.env.JWT_SECRET = 'test-secret-for-reset-tests';
  process.env.RATE_LIMIT_MAX = '100000';
  process.env.FORGOT_PASSWORD_RATE_LIMIT_MAX = '1000';
  process.env.RESET_PASSWORD_RATE_LIMIT_MAX = '1000';
});

import app from '../index';

async function register(baseUrl: string, email: string, password: string) {
  return jsonFetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ email, password, name: 'Reset User' }),
  });
}

async function forgot(baseUrl: string, email: string) {
  return jsonFetch(`${baseUrl}/api/auth/forgot-password`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

function extractToken(devResetUrl: string): string {
  const match = devResetUrl.match(/[?&]reset_token=([^&]+)/);
  if (!match) throw new Error(`No reset_token in ${devResetUrl}`);
  return decodeURIComponent(match[1]);
}

describe('POST /api/auth/forgot-password', () => {
  it('rejects malformed emails', async () => {
    await withServer(app, async (baseUrl) => {
      const res = await forgot(baseUrl, 'not-an-email');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid email address');
    });
  });

  it('never reveals whether an email exists (unknown account → same generic 200)', async () => {
    await withServer(app, async (baseUrl) => {
      const res = await forgot(baseUrl, 'ghost@nowhere.dev');
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('If an account exists');
      expect(res.body.devResetUrl).toBeUndefined();
    });
  });

  it('issues a dev reset link for existing accounts in non-production', async () => {
    await withServer(app, async (baseUrl) => {
      await register(baseUrl, 'resetme@user.dev', 'old-pass-1');
      const res = await forgot(baseUrl, 'resetme@user.dev');
      expect(res.status).toBe(200);
      expect(res.body.devResetUrl).toContain('reset_token=');
    });
  });
});

describe('POST /api/auth/reset-password — full lifecycle', () => {
  it('completes the full reset flow and allows login with the new password', async () => {
    await withServer(app, async (baseUrl) => {
      await register(baseUrl, 'flow@user.dev', 'original-pw');
      const forgotRes = await forgot(baseUrl, 'flow@user.dev');
      const token = extractToken(forgotRes.body.devResetUrl);

      const reset = await jsonFetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ token, password: 'brand-new-pw' }),
      });
      expect(reset.status).toBe(200);
      expect(reset.body.message).toContain('Password updated');

      // New password works.
      const loginNew = await jsonFetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: 'flow@user.dev', password: 'brand-new-pw' }),
      });
      expect(loginNew.status).toBe(200);
      expect(loginNew.body.token).toBeTruthy();

      // Old password no longer works.
      const loginOld = await jsonFetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: 'flow@user.dev', password: 'original-pw' }),
      });
      expect(loginOld.status).toBe(401);
    });
  });

  it('tokens are single-use — a second reset attempt is rejected', async () => {
    await withServer(app, async (baseUrl) => {
      await register(baseUrl, 'single@user.dev', 'pw-one-123');
      const forgotRes = await forgot(baseUrl, 'single@user.dev');
      const token = extractToken(forgotRes.body.devResetUrl);

      const first = await jsonFetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ token, password: 'pw-two-123' }),
      });
      expect(first.status).toBe(200);

      const second = await jsonFetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ token, password: 'pw-three-123' }),
      });
      expect(second.status).toBe(400);
      expect(second.body.error).toContain('Invalid or expired');
    });
  });

  it('rejects unknown, garbage, and missing tokens', async () => {
    await withServer(app, async (baseUrl) => {
      const garbage = await jsonFetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ token: 'not-a-real-token', password: 'new-pw-123' }),
      });
      expect(garbage.status).toBe(400);

      const missing = await jsonFetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: 'new-pw-123' }),
      });
      expect(missing.status).toBe(400);
      expect(missing.body.error).toContain('Reset token is required');
    });
  });

  it('rejects weak passwords', async () => {
    await withServer(app, async (baseUrl) => {
      await register(baseUrl, 'weak@user.dev', 'pw-long-enough');
      const forgotRes = await forgot(baseUrl, 'weak@user.dev');
      const token = extractToken(forgotRes.body.devResetUrl);

      const res = await jsonFetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ token, password: 'abc' }),
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('at least 6 characters');
    });
  });
});
