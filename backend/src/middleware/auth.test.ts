/**
 * middleware/auth.test.ts — Unit tests for JWT verification middleware
 */
import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { authMiddleware, optionalAuth } from './auth';
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

function validToken(userId = 'u1', email = 'a@b.com'): string {
  return jwt.sign({ userId, email }, Settings.JWT_SECRET);
}

describe('authMiddleware', () => {
  it('rejects requests without an Authorization header', () => {
    const req: any = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('No token provided');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects non-Bearer Authorization headers', () => {
    const req: any = { headers: { authorization: 'Basic abc123' } };
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
  });

  it('rejects invalid/expired tokens', () => {
    const req: any = { headers: { authorization: 'Bearer not-a-real-token' } };
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Invalid or expired token');
  });

  it('attaches userId + email for a valid token', () => {
    const req: any = { headers: { authorization: `Bearer ${validToken()}` } };
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe('u1');
    expect(req.userEmail).toBe('a@b.com');
    expect(res.statusCode).toBe(200);
  });
});

describe('optionalAuth', () => {
  it('proceeds without auth when no header is present', () => {
    const req: any = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBeUndefined();
  });

  it('attaches identity for a valid token', () => {
    const req: any = { headers: { authorization: `Bearer ${validToken('u9', 'x@y.z')}` } };
    const res = mockRes();
    const next = vi.fn();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe('u9');
  });

  it('proceeds (without identity) for an invalid token', () => {
    const req: any = { headers: { authorization: 'Bearer garbage' } };
    const res = mockRes();
    const next = vi.fn();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBeUndefined();
  });
});
