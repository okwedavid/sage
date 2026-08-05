/**
 * routes/auth.ts
 * OWNS: Authentication endpoints
 */
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Settings } from '../config/settings';

const router = Router();

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

// In-memory user store (replace with Supabase Auth in production)
const users: Map<string, { id: string; email: string; password: string; name: string }> = new Map();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
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

    if (users.has(email)) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

  const userId = uuidv4();
  users.set(email, {
    id: userId,
    email,
    password: await hashPassword(password),
    name: name || email.split('@')[0],
  });

  const token = jwt.sign({ userId, email }, Settings.JWT_SECRET, {
    expiresIn: Settings.JWT_EXPIRES_IN,
  } as jwt.SignOptions);

  res.status(201).json({
    token,
    user: { id: userId, email, name: name || email.split('@')[0] },
  });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = users.get(email);
    if (!user || !(await verifyPassword(password, user.password))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

  const token = jwt.sign({ userId: user.id, email: user.email }, Settings.JWT_SECRET, {
    expiresIn: Settings.JWT_EXPIRES_IN,
  } as jwt.SignOptions);

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
  });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/demo — instant demo access
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
