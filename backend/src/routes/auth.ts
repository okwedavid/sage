/**
 * routes/auth.ts
 * OWNS: Authentication endpoints
 */
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Settings } from '../config/settings';

const router = Router();

// In-memory user store (replace with Supabase Auth in production)
const users: Map<string, { id: string; email: string; password: string; name: string }> = new Map();

// POST /api/auth/register
router.post('/register', (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  if (users.has(email)) {
    res.status(409).json({ error: 'User already exists' });
    return;
  }

  const userId = uuidv4();
  users.set(email, { id: userId, email, password, name: name || email.split('@')[0] });

  const token = jwt.sign({ userId, email }, Settings.JWT_SECRET, {
    expiresIn: Settings.JWT_EXPIRES_IN,
  } as jwt.SignOptions);

  res.status(201).json({
    token,
    user: { id: userId, email, name: name || email.split('@')[0] },
  });
});

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = users.get(email);
  if (!user || user.password !== password) {
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
