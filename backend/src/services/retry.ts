/**
 * services/retry.ts
 * OWNS: Retry-with-backoff for transient failures
 *
 * Retries only when the failure looks transient: network errors (no status),
 * HTTP 429 (rate limited) and 5xx (server errors). Auth (401/403) and
 * validation (4xx) failures are NOT retried — they would fail again.
 */
export interface RetryOptions {
  attempts?: number;      // total attempts, including the first (default 2)
  baseDelayMs?: number;   // exponential backoff base (default 300)
  maxDelayMs?: number;    // cap per backoff step (default 3000)
  shouldRetry?: (error: any) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 2);
  const baseDelayMs = options.baseDelayMs ?? 300;
  const maxDelayMs = options.maxDelayMs ?? 3000;
  const shouldRetry =
    options.shouldRetry ??
    ((error: any) => {
      const status = error?.status ?? error?.statusCode;
      return status === undefined || status === 429 || status >= 500;
    });

  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || i === attempts - 1) throw error;
      const delay = Math.min(baseDelayMs * 2 ** i, maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
