/**
 * services/retry.test.ts — Retry-with-backoff behavior
 */
import { describe, it, expect, vi } from 'vitest';
import { withRetry } from './retry';

describe('withRetry', () => {
  it('returns the value on the first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries transient failures (5xx / network) then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 503 }))
      .mockResolvedValueOnce('recovered');
    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 1 })).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries network errors with no status code', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce('ok');
    await expect(withRetry(fn, { attempts: 2, baseDelayMs: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry auth/validation failures (401, 400)', async () => {
    const err401 = Object.assign(new Error('unauthorized'), { status: 401 });
    const fn = vi.fn().mockRejectedValue(err401);
    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 1 })).rejects.toBe(err401);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting all attempts', async () => {
    const err = Object.assign(new Error('still down'), { status: 500 });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { attempts: 2, baseDelayMs: 1 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('honors a custom shouldRetry predicate', async () => {
    const err = Object.assign(new Error('flaky'), { status: 418 });
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce('ok');
    await expect(
      withRetry(fn, { attempts: 2, baseDelayMs: 1, shouldRetry: () => true })
    ).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
