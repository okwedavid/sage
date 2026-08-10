/**
 * services/email.test.ts — Email service tests.
 *
 * Without RESEND_API_KEY the service degrades to `false` (the caller decides
 * how to surface the reset link). With a key and a mocked Resend SDK it sends
 * the reset email and reports success. Modules are re-imported per test so the
 * env-dependent Settings snapshot is fresh each time.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

describe('email service (unconfigured)', () => {
  it('reports unconfigured and returns false without sending', async () => {
    vi.resetModules();
    vi.stubEnv('RESEND_API_KEY', '');
    const { isEmailConfigured, sendPasswordResetEmail } = await import('./email');

    expect(isEmailConfigured()).toBe(false);
    expect(await sendPasswordResetEmail('user@test.dev', 'https://app.sage.ai/?reset_token=x')).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

describe('email service (Resend configured)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    mockSend.mockReset();
  });

  it('sends a password reset email and returns true', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email_1' } });
    const { sendPasswordResetEmail } = await import('./email');

    const ok = await sendPasswordResetEmail('user@test.dev', 'https://app.sage.ai/?reset_token=abc123');
    expect(ok).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe('user@test.dev');
    expect(call.subject).toContain('Reset your SAGE password');
    expect(call.html).toContain('https://app.sage.ai/?reset_token=abc123');
    expect(call.html).toContain('expires in 1 hour');
  });

  it('returns false when the provider rejects the send', async () => {
    mockSend.mockRejectedValue(new Error('rate limited'));
    const { sendPasswordResetEmail } = await import('./email');

    const ok = await sendPasswordResetEmail('user@test.dev', 'https://app.sage.ai/?reset_token=abc');
    expect(ok).toBe(false);
  });
});
