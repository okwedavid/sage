/**
 * middleware/api-key.test.ts — Unit tests for API-key auth middleware.
 * Uses the real api-keys service (in-memory mode) so quota + scope behavior
 * is exercised end-to-end through the middleware.
 */
import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { requireApiKey, jwtOrApiKey } from './api-key';
import { createKey } from '../services/api-keys';
import { Settings } from '../config/settings';

function mockRes() {
  const res: any = { statusCode: 200 };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: any) => {
    res.body = body;
    return res;
  });
  return res;
}

function validJwt(userId = 'u1'): string {
  return jwt.sign({ userId, email: 'a@b.com' }, Settings.JWT_SECRET);
}

describe('requireApiKey', () => {
  it('rejects requests without an API key', async () => {
    const req: any = { headers: {}, originalUrl: '/api/chat' };
    const res = mockRes();
    const next = vi.fn();

    await requireApiKey()(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('sk_sage_');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects malformed tokens that are not API keys', async () => {
    const req: any = { headers: { authorization: 'Bearer not-a-key' }, originalUrl: '/api/chat' };
    const res = mockRes();
    const next = vi.fn();

    await requireApiKey()(req, res, next);

    expect(res.statusCode).toBe(401);
  });

  it('accepts a valid API key and attaches identity', async () => {
    const { plaintext } = (await createKey({ userId: 'u1', name: 'k1' }))!;
    const req: any = { headers: { authorization: `Bearer ${plaintext}` }, originalUrl: '/api/chat', method: 'POST' };
    const res = mockRes();
    const next = vi.fn();

    await requireApiKey()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe('u1');
    expect(req.apiKey?.scopes).toEqual(['chat']);
  });

  it('rejects unknown keys', async () => {
    const req: any = { headers: { authorization: 'Bearer sk_sage_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }, originalUrl: '/api/chat' };
    const res = mockRes();
    const next = vi.fn();

    await requireApiKey()(req, res, next);

    expect(res.statusCode).toBe(401);
  });

  it('returns 429 when the daily quota is exceeded', async () => {
    const { plaintext } = (await createKey({ userId: 'u2', quotaPerDay: 1 }))!;
    const headers = { authorization: `Bearer ${plaintext}` };

    // First call uses the quota.
    let req: any = { headers, originalUrl: '/api/chat', method: 'POST' };
    let res = mockRes();
    const firstNext = vi.fn();
    await requireApiKey()(req, res, firstNext);
    expect(res.statusCode).toBe(200);

    // Second call exceeds it.
    req = { headers, originalUrl: '/api/chat', method: 'POST' };
    res = mockRes();
    const next = vi.fn();
    await requireApiKey()(req, res, next);
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toContain('quota');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when the key lacks the required scope', async () => {
    const { plaintext } = (await createKey({ userId: 'u3', scopes: ['chat'] }))!;
    const req: any = { headers: { authorization: `Bearer ${plaintext}` }, originalUrl: '/api/admin', method: 'GET' };
    const res = mockRes();
    const next = vi.fn();

    await requireApiKey('admin')(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('scope');
  });
});

describe('jwtOrApiKey', () => {
  it('passes through without auth when nothing is present', () => {
    const req: any = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    jwtOrApiKey(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBeUndefined();
  });

  it('resolves a valid API key', async () => {
    const { plaintext } = (await createKey({ userId: 'u4' }))!;
    const req: any = { headers: { authorization: `Bearer ${plaintext}` }, originalUrl: '/api/chat', method: 'POST' };
    const res = mockRes();
    const next = vi.fn();

    jwtOrApiKey(req, res, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe('u4');
    expect(req.apiKey?.id).toBeTruthy();
  });

  it('resolves a valid JWT', () => {
    const req: any = { headers: { authorization: `Bearer ${validJwt('u9')}` } };
    const res = mockRes();
    const next = vi.fn();

    jwtOrApiKey(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe('u9');
  });

  it('proceeds unauthenticated for an invalid JWT', () => {
    const req: any = { headers: { authorization: 'Bearer garbage.jwt.here' } };
    const res = mockRes();
    const next = vi.fn();

    jwtOrApiKey(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBeUndefined();
  });
});
