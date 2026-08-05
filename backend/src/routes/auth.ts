/**
 * routes/auth.ts
 * OWNS: Authentication endpoints
 *
 * Persistence: when Supabase is configured, users are stored in the `users`
 * table (scrypt-hashed passwords). When it is not, an in-memory Map is used so
 * the app still works for local/demo runs. The two modes never mix: if
 * Supabase is configured, failures are real errors (no silent split-brain).
 */
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Settings } from '../config/settings';
import { isSupabaseConfigured, createUser, findUserByEmail, findUserById, recordAudit } from '../services/supabase';

const router = Router();

// Stricter per-route limiters for auth endpoints — the global /api limiter
// throttles everything but gives weak brute-force protection here.
const loginLimiter = rateLimit({
  windowMs: Settings.LOGIN_RATE_LIMIT_WINDOW_MS,
  max: Settings.LOGIN_RATE_LIMIT_MAX,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: Settings.LOGIN_RATE_LIMIT_WINDOW_MS,
  max: Math.max(Settings.LOGIN_RATE_LIMIT_MAX * 2, 20),
  message: { error: 'Too many registration attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

// ── Password hashing (scrypt — no plaintext ever stored) ──
// Format: scrypt:<saltHex>:<hashHex>
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split(':');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// In-memory fallback user store (only when Supabase is not configured)
const users: Map<string, { id: string; email: string; password: string; name: string; bannedUntil?: string }> = new Map();

interface AuthUser {
  id: string;
  email: string;
  name: string;
  isAdmin?: boolean;
}

function signToken(user: AuthUser): string {
  return jwt.sign({ userId: user.id, email: user.email }, Settings.JWT_SECRET, {
    expiresIn: Settings.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

function clientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
}

// POST /api/auth/register
router.post('/register', registerLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }
    if (typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }
    if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      res.status(400).json({ error: 'Invalid email address' });
      return;
    }

    const displayName = name || email.split('@')[0];
    const userId = uuidv4();
    const passwordHash = await hashPassword(password);

    if (isSupabaseConfigured()) {
      const existing = await findUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: 'User already exists' });
        return;
      }
      const user = await createUser({ id: userId, email, name: displayName, passwordHash });
      if (!user) {
        res.status(500).json({ error: 'Registration failed' });
        return;
      }
      await recordAudit({ actorType: 'user', actorId: user.id, action: 'auth.register', resource: email, ip: clientIp(req), userAgent: req.headers['user-agent'] as string });
      res.status(201).json({ token: signToken(user), user: { id: user.id, email, name: user.name } });
      return;
    }

    // In-memory fallback
    if (users.has(email)) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }
    users.set(email, { id: userId, email, password: passwordHash, name: displayName });
    res.status(201).json({ token: signToken({ id: userId, email, name: displayName }), user: { id: userId, email, name: displayName } });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    if (isSupabaseConfigured()) {
      const user = await findUserByEmail(email);
      if (!user || !user.password_hash) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
      const ok = await verifyPassword(password, user.password_hash);
      if (!ok) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
      if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) {
        res.status(403).json({ error: 'Account suspended. Contact support.' });
        return;
      }
      await recordAudit({ actorType: 'user', actorId: user.id, action: 'auth.login', resource: email, ip: clientIp(req), userAgent: req.headers['user-agent'] as string });
      res.json({ token: signToken(user), user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin } });
      return;
    }

    // In-memory fallback
    const user = users.get(email);
    if (!user || !(await verifyPassword(password, user.password))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    if (user.bannedUntil && new Date(user.bannedUntil).getTime() > Date.now()) {
      res.status(403).json({ error: 'Account suspended. Contact support.' });
      return;
    }
    res.json({ token: signToken(user), user: { id: user.id, email: user.email, name: user.name, isAdmin: false } });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me — resolve the current token to a user (used by admin checks)
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    let decoded: any;
    try {
      decoded = jwt.verify(authHeader.slice(7), Settings.JWT_SECRET);
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    if (isSupabaseConfigured()) {
      const user = await findUserById(decoded.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin } });
      return;
    }

    const memUser = Array.from(users.values()).find((u) => u.id === decoded.userId);
    if (!memUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: { id: memUser.id, email: memUser.email, name: memUser.name, isAdmin: false } });
  } catch (error: any) {
    console.error('Me error:', error);
    res.status(500).json({ error: 'Failed to resolve user' });
  }
});

// POST /api/auth/demo — instant demo access (never persisted)
router.post('/demo', (_req: Request, res: Response) => {
  const userId = uuidv4();
  const email = 'demo@sage.ai';

  const token = jwt.sign({ userId, email }, Settings.JWT_SECRET, {
    expiresIn: '24h',
  } as jwt.SignOptions);

  res.json({
    token,
    user: { id: userId, email, name: 'SAGE Explorer' },
  });
});

export default router;
