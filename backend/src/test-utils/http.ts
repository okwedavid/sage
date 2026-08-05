/**
 * test-utils/http.ts — Shared helpers for app-level (integration) tests.
 *
 * Boots an express app on an ephemeral port and exposes a JSON fetch helper.
 * Uses Node's global fetch (Node 20+) — no extra dependencies.
 */
import type { Express } from 'express';
import type { Server } from 'node:http';

/**
 * Boot `app` on port 0 (ephemeral), run `fn` with the base URL, then shut down.
 * Always closes the server, even when the callback throws.
 */
export async function withServer<T>(
  app: Express,
  fn: (baseUrl: string) => Promise<T>
): Promise<T> {
  const server: Server = await new Promise((resolve) => {
    const srv = app.listen(0, () => resolve(srv));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    return await fn(baseUrl);
  } finally {
    // Force-close idle keep-alive sockets so shutdown never hangs on slow CI
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

export interface JsonResponse {
  status: number;
  body: any;
}

/** GET/POST helper that always parses JSON (or returns null body). */
export async function jsonFetch(
  url: string,
  init: RequestInit = {}
): Promise<JsonResponse> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...((init.headers as Record<string, string>) || {}),
    },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}
