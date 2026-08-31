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
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { Settings } from '../config/settings';
import {
  isSupabaseConfigured,
  createUser,
  findUserByEmail,
  findUserById,
  recordAudit,
  createPasswordReset,
  findActivePasswordReset,
  consumePasswordReset,
  revokePasswordResets,
  updateUserPassword,
} from '../services/supabase';
import { sendPasswordResetEmail } from '../services/email';

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

// Tight limiter for reset requests: prevents mass emailing / token spraying
// while still allowing a handful of legitimate attempts. Max is env-tunable
// so test suites can raise it without changing production defaults.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Math.max(1, parseInt(process.env.FORGOT_PASSWORD_RATE_LIMIT_MAX || '5', 10) || 5),
  message: { error: 'Too many reset requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Math.max(1, parseInt(process.env.RESET_PASSWORD_RATE_LIMIT_MAX || '10', 10) || 10),
  message: { error: 'Too many reset attempts, please try again later' },
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

// In-memory fallback for password reset tokens (only when Supabase is not
// configured). Stores only the token HASH — never the token itself.
const memResets = new Map<string, { userId: string; expiresAt: string; used: boolean }>();

/**
 * Demo-mode user lookup by email. Used by the organizations route to resolve
 * invitations when Supabase is not configured (the service layer stays
 * persistence-agnostic). Returns null when the account does not exist.
 */
export function findInMemoryUser(email: string): { id: string; email: string; name: string } | null {
  const user = users.get(email.toLowerCase());
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}

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
      res.status(201).json({ token: signToken(user), user: { id: user.id, email, name: user.name, isAdmin: Boolean(user.is_admin) } });
      return;
    }

    // In-memory fallback
    if (users.has(email)) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }
    users.set(email, { id: userId, email, password: passwordHash, name: displayName });
    res.status(201).json({ token: signToken({ id: userId, email, name: displayName }), user: { id: userId, email, name: displayName, isAdmin: false } });
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

// POST /api/auth/forgot-password — request a password reset link
//
// SECURITY:
//   - Uniform 200 response whether or not the account exists (no enumeration).
//   - Rate-limited per IP (5 / 15 min).
//   - Tokens are random 32-byte values; only their SHA-256 hash is stored.
//   - Tokens expire after PASSWORD_RESET_TTL_MS (default 1 hour).
//   - In non-production, when no email provider is configured, the reset link
//     is returned as `devResetUrl` so local flows work without SMTP. In
//     production the link is only delivered by email (RESEND_API_KEY).
router.post('/forgot-password', forgotPasswordLimiter, async (req: Request, res: Response) => {
  const { email } = req.body || {};

  if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    res.status(400).json({ error: 'Invalid email address' });
    return;
  }

  const generic = { message: 'If an account exists for that email, a password reset link has been sent.' };

  // Resolve the account WITHOUT revealing whether it exists.
  let userId: string | null = null;
  if (isSupabaseConfigured()) {
    const user = await findUserByEmail(email);
    if (user?.password_hash) userId = user.id;
  } else {
    const memUser = users.get(email.toLowerCase());
    if (memUser) userId = memUser.id;
  }

  if (!userId) {
    res.json(generic);
    return;
  }

  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + Settings.PASSWORD_RESET_TTL_MS).toISOString();

  let stored = false;
  if (isSupabaseConfigured()) {
    const row = await createPasswordReset({
      userId,
      tokenHash,
      expiresAt,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] as string,
    });
    stored = Boolean(row);
  } else {
    memResets.set(tokenHash, { userId, expiresAt, used: false });
    stored = true;
  }

  if (!stored) {
    console.error('Password reset persistence failed — no reset issued');
    res.json(generic);
    return;
  }

  await recordAudit({
    actorType: 'user',
    actorId: userId,
    action: 'auth.password_reset_requested',
    resource: email,
    ip: clientIp(req),
    userAgent: req.headers['user-agent'] as string,
  });

  const resetUrl = `${Settings.FRONTEND_URL}/?reset_token=${token}`;
  const sent = await sendPasswordResetEmail(email, resetUrl);

  if (sent) {
    res.json(generic);
    return;
  }
  if (Settings.NODE_ENV !== 'production') {
    // Dev convenience only — never returned in production.
    res.json({ ...generic, devResetUrl: resetUrl });
    return;
  }
  console.warn('[auth] RESEND_API_KEY not configured — password reset email not sent');
  res.json(generic);
});

// POST /api/auth/reset-password — set a new password with a valid token
router.post('/reset-password', resetPasswordLimiter, async (req: Request, res: Response) => {
  const { token, password } = req.body || {};

  if (typeof token !== 'string' || !token.trim()) {
    res.status(400).json({ error: 'Reset token is required' });
    return;
  }
  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');

  if (isSupabaseConfigured()) {
    const reset = await findActivePasswordReset(tokenHash);
    if (!reset) {
      // Expired, already used, or unknown — same message, no oracle.
      res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const updated = await updateUserPassword(reset.user_id, passwordHash);
    if (!updated) {
      res.status(500).json({ error: 'Failed to update password. Please try again.' });
      return;
    }

    await consumePasswordReset(reset.id);
    await revokePasswordResets(reset.user_id);
    await recordAudit({
      actorType: 'user',
      actorId: reset.user_id,
      action: 'auth.password_reset',
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] as string,
    });
    res.json({ message: 'Password updated. You can now sign in with your new password.' });
    return;
  }

  // In-memory fallback
  const memReset = memResets.get(tokenHash);
  const memUser = memReset ? Array.from(users.values()).find((u) => u.id === memReset.userId) : undefined;
  if (!memReset || memReset.used || new Date(memReset.expiresAt).getTime() < Date.now() || !memUser) {
    res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    return;
  }

  memUser.password = await hashPassword(password);
  memReset.used = true;
  memResets.delete(tokenHash);
  res.json({ message: 'Password updated. You can now sign in with your new password.' });
});

// POST /api/auth/demo — instant demo access (never persisted)
//
// Demo sessions share ONE quota bucket per IP (stable pseudo-userId derived
// from the client IP). A fresh random id per call would let anyone mint
// unlimited fresh Free-tier quotas — an obvious bypass. Demo users are not
// persisted and cannot access admin/org APIs that require real accounts.
router.post('/demo', (req: Request, res: Response) => {
  const ip = clientIp(req);
  const userId = 'demo-' + createHash('sha256').update(ip || 'local').digest('hex').slice(0, 12);
  const email = 'demo@sage.ai';

  const token = jwt.sign({ userId, email }, Settings.JWT_SECRET, {
    expiresIn: '24h',
  } as jwt.SignOptions);

  res.json({
    token,
    user: { id: userId, email, name: 'SAGE Explorer', isAdmin: false },
  });
});

export default router;
