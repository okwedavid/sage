/**
 * routes/auth-password-reset.supabase.test.ts — Password reset with Supabase
 * persistence. Mocks services/supabase so the DB-backed branches of the
 * forgot/reset endpoints are exercised (token hashing, single-use, failure
 * handling, no-enumeration contract).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { withServer, jsonFetch } from '../test-utils/http';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    configured: true,
    findUserByEmail: vi.fn(),
    createPasswordReset: vi.fn(),
    findActivePasswordReset: vi.fn(),
    consumePasswordReset: vi.fn(async () => true),
    revokePasswordResets: vi.fn(async () => {}),
    updateUserPassword: vi.fn(async () => true),
    recordAudit: vi.fn(async () => {}),
  },
}));

vi.mock('../services/supabase', () => ({
  isSupabaseConfigured: () => mockSupabase.configured,
  findUserByEmail: (...args: any[]) => (mockSupabase.findUserByEmail as any)(...args),
  createPasswordReset: (...args: any[]) => (mockSupabase.createPasswordReset as any)(...args),
  findActivePasswordReset: (...args: any[]) => (mockSupabase.findActivePasswordReset as any)(...args),
  consumePasswordReset: (...args: any[]) => (mockSupabase.consumePasswordReset as any)(...args),
  revokePasswordResets: (...args: any[]) => (mockSupabase.revokePasswordResets as any)(...args),
  updateUserPassword: (...args: any[]) => (mockSupabase.updateUserPassword as any)(...args),
  recordAudit: (...args: any[]) => (mockSupabase.recordAudit as any)(...args),
}));

vi.hoisted(() => {
  process.env.GROQ_API_KEY = 'gsk_test_server_key';
  process.env.JWT_SECRET = 'test-secret-for-reset-supabase';
  process.env.RATE_LIMIT_MAX = '100000';
  process.env.FORGOT_PASSWORD_RATE_LIMIT_MAX = '1000';
  process.env.RESET_PASSWORD_RATE_LIMIT_MAX = '1000';
});

import app from '../index';

beforeEach(() => {
  mockSupabase.configured = true;
  mockSupabase.findUserByEmail.mockReset();
  mockSupabase.createPasswordReset.mockReset();
  mockSupabase.findActivePasswordReset.mockReset();
  mockSupabase.consumePasswordReset.mockReset().mockResolvedValue(true);
  mockSupabase.revokePasswordResets.mockReset().mockResolvedValue(undefined);
  mockSupabase.updateUserPassword.mockReset().mockResolvedValue(true);
  mockSupabase.recordAudit.mockClear();
});

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('forgot-password with Supabase', () => {
  it('stores only the token HASH and issues a dev reset link', async () => {
    mockSupabase.findUserByEmail.mockResolvedValue({
      id: 'db-1',
      email: 'db@user.dev',
      password_hash: 'scrypt:hash',
    });
    mockSupabase.createPasswordReset.mockResolvedValue({ id: 'r1' });

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/auth/forgot-password`, {
        method: 'POST',
        body: JSON.stringify({ email: 'db@user.dev' }),
      });
      expect(status).toBe(200);
      expect(body.devResetUrl).toContain('reset_token=');

      const token = decodeURIComponent(body.devResetUrl.match(/reset_token=([^&]+)/)[1]);
      // The DB receives the SHA-256 hash, never the token itself.
      const arg = mockSupabase.createPasswordReset.mock.calls[0][0];
      expect(arg.tokenHash).toBe(sha256(token));
      expect(arg.tokenHash).not.toBe(token);
      expect(arg.userId).toBe('db-1');
      expect(arg.expiresAt).toBeTruthy();
    });
  });

  it('does not issue a reset for accounts without a password hash', async () => {
    mockSupabase.findUserByEmail.mockResolvedValue({
      id: 'db-1',
      email: 'nopw@user.dev',
      password_hash: null,
    });

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/auth/forgot-password`, {
        method: 'POST',
        body: JSON.stringify({ email: 'nopw@user.dev' }),
      });
      expect(status).toBe(200);
      expect(body.devResetUrl).toBeUndefined();
      expect(mockSupabase.createPasswordReset).not.toHaveBeenCalled();
    });
  });

  it('keeps the generic response when reset persistence fails', async () => {
    mockSupabase.findUserByEmail.mockResolvedValue({
      id: 'db-1',
      email: 'db@user.dev',
      password_hash: 'scrypt:hash',
    });
    mockSupabase.createPasswordReset.mockResolvedValue(null);

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/auth/forgot-password`, {
        method: 'POST',
        body: JSON.stringify({ email: 'db@user.dev' }),
      });
      expect(status).toBe(200);
      expect(body.message).toContain('If an account exists');
      expect(body.devResetUrl).toBeUndefined();
    });
  });
});

describe('reset-password with Supabase', () => {
  it('updates the password, consumes the token, and revokes outstanding resets', async () => {
    mockSupabase.findActivePasswordReset.mockResolvedValue({
      id: 'r1',
      user_id: 'db-1',
      token_hash: sha256('tok-123'),
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      used_at: null,
    });

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ token: 'tok-123', password: 'new-pass-9' }),
      });
      expect(status).toBe(200);
      expect(body.message).toContain('Password updated');

      // New password reaches the DB as a scrypt hash — never plaintext.
      const pwArg = (mockSupabase.updateUserPassword as any).mock.calls[0];
      expect(pwArg[0]).toBe('db-1');
      expect(pwArg[1]).toMatch(/^scrypt:/);
      expect(mockSupabase.consumePasswordReset).toHaveBeenCalledWith('r1');
      expect(mockSupabase.revokePasswordResets).toHaveBeenCalledWith('db-1');
    });
  });

  it('rejects expired, used, or unknown tokens with the same message', async () => {
    mockSupabase.findActivePasswordReset.mockResolvedValue(null);

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ token: 'stale-token', password: 'new-pass-9' }),
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid or expired');
      expect(mockSupabase.updateUserPassword).not.toHaveBeenCalled();
    });
  });

  it('returns 500 when the password update fails (token NOT consumed)', async () => {
    mockSupabase.findActivePasswordReset.mockResolvedValue({
      id: 'r1',
      user_id: 'db-1',
      token_hash: sha256('tok-456'),
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      used_at: null,
    });
    mockSupabase.updateUserPassword.mockResolvedValue(false);

    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ token: 'tok-456', password: 'new-pass-9' }),
      });
      expect(status).toBe(500);
      expect(mockSupabase.consumePasswordReset).not.toHaveBeenCalled();
    });
  });
});
