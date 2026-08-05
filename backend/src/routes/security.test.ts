/**
 * routes/security.test.ts — App-level security controls
 *
 * Verifies the hardened error handler (400/413/403 mapping), helmet headers,
 * production CORS enforcement, and rate limiting. CORS/rate-limit tests boot
 * fresh app instances (via vi.resetModules) with production-style env.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { withServer, jsonFetch } from '../test-utils/http';

vi.hoisted(() => {
  process.env.GROQ_API_KEY = 'gsk_test_server_key';
  process.env.RATE_LIMIT_MAX = '100000';
  process.env.JWT_SECRET = 'test-secret-for-security-tests';
});

import app from '../index';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('body parsing hardening', () => {
  it('returns 400 for malformed JSON bodies', async () => {
    await withServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"message": "unterminated',
      });
      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error).toBe('Malformed JSON body');
    });
  });

  it('returns 413 for oversized request bodies', async () => {
    await withServer(app, async (baseUrl) => {
      const big = 'x'.repeat(11 * 1024 * 1024); // > 10mb express limit
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: big }),
      });
      expect(res.status).toBe(413);
      const body: any = await res.json();
      expect(body.error).toBe('Payload too large');
    });
  });
});

describe('security headers', () => {
  it('sends helmet headers and disables x-powered-by', async () => {
    await withServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/agents`);
      expect(res.headers.get('x-powered-by')).toBeNull();
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBeTruthy();
      expect(res.headers.get('content-security-policy')).toBeTruthy();
      expect(res.headers.get('strict-transport-security')).toBeTruthy();
    });
  });
});

describe('CORS in production', () => {
  async function bootProdApp() {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RATE_LIMIT_MAX', '100000');
    return (await import('../index')).default;
  }

  it('rejects disallowed origins with 403', async () => {
    const prodApp = await bootProdApp();
    await withServer(prodApp, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/agents`, {
        headers: { Origin: 'https://evil.example.com' },
      });
      expect(res.status).toBe(403);
      const body: any = await res.json();
      expect(body.error).toContain('CORS');
    });
  });

  it('allows configured origins and any *.vercel.app origin', async () => {
    const prodApp = await bootProdApp();
    await withServer(prodApp, async (baseUrl) => {
      const vercel = await fetch(`${baseUrl}/api/agents`, {
        headers: { Origin: 'https://sage-anything.vercel.app' },
      });
      expect(vercel.status).toBe(200);

      const localhost = await fetch(`${baseUrl}/api/agents`, {
        headers: { Origin: 'http://localhost:3000' },
      });
      expect(localhost.status).toBe(200);

      const noOrigin = await fetch(`${baseUrl}/api/agents`);
      expect(noOrigin.status).toBe(200); // curl / mobile clients
    });
  });
});

describe('rate limiting', () => {
  it('rejects requests beyond the configured limit with 429', async () => {
    vi.resetModules();
    vi.stubEnv('RATE_LIMIT_MAX', '2');
    const { default: limitedApp } = await import('../index');

    await withServer(limitedApp, async (baseUrl) => {
      expect((await jsonFetch(`${baseUrl}/api/agents`)).status).toBe(200);
      expect((await jsonFetch(`${baseUrl}/api/agents`)).status).toBe(200);
      const third = await jsonFetch(`${baseUrl}/api/agents`);
      expect(third.status).toBe(429);
      expect(third.body.error).toContain('Too many requests');
    });
  });
});
