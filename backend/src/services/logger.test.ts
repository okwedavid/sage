/**
 * services/logger.test.ts — Structured logging + request IDs
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, requestLogger } from './logger';
import { withServer, jsonFetch } from '../test-utils/http';

vi.hoisted(() => {
  process.env.GROQ_API_KEY = 'gsk_test_server_key';
  process.env.JWT_SECRET = 'test-secret-for-logger-tests';
});

import app from '../index';

describe('logger', () => {
  const spies: Record<string, any> = {};

  beforeEach(() => {
    spies.log = vi.spyOn(console, 'log').mockImplementation(() => {});
    spies.warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    spies.error = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits JSON lines with level, message and meta', () => {
    logger.info('hello', { userId: 'u1' });
    const line = spies.log.mock.calls[0][0];
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe('info');
    expect(parsed.msg).toBe('hello');
    expect(parsed.userId).toBe('u1');
    expect(typeof parsed.ts).toBe('string');
  });

  it('routes error level to console.error', () => {
    logger.error('boom', { requestId: 'r1' });
    const line = spies.error.mock.calls[0][0];
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe('error');
    expect(parsed.requestId).toBe('r1');
  });

  it('routes warn level to console.warn', () => {
    logger.warn('careful');
    const line = spies.warn.mock.calls[0][0];
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe('warn');
    expect(parsed.msg).toBe('careful');
  });

});

describe('requestLogger middleware', () => {
  it('sets an X-Request-Id header on responses', async () => {
    await withServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/agents`);
      expect(res.headers.get('x-request-id')).toBeTruthy();
      await res.json();
    });
  });

  it('does not break normal request flow', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/agents`);
      expect(status).toBe(200);
      expect(body.agents.length).toBeGreaterThan(0);
    });
  });

  it('logs rejected (4xx) requests at warn level with a request id', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await withServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nobody@x.dev', password: 'wrong' }),
      });
      expect(res.status).toBe(401);
      expect(res.headers.get('x-request-id')).toBeTruthy();
      // allow the 'finish' listener to fire
      await new Promise((r) => setTimeout(r, 50));
      const logged = warnSpy.mock.calls.some((c) => {
        try {
          const p = JSON.parse(c[0]);
          return p.level === 'warn' && p.status === 401;
        } catch {
          return false;
        }
      });
      expect(logged).toBe(true);
    });
    warnSpy.mockRestore();
  });
});
