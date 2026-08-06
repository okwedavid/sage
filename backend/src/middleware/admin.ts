/**
 * middleware/admin.ts
 * OWNS: Admin authorization guard.
 *
 * Verifies the JWT, then checks the user is an administrator:
 *  - Supabase mode: `users.is_admin` from the DB (source of truth).
 *  - In-memory mode: the token carries an `isAdmin` claim, or the email is
 *    listed in ADMIN_EMAILS env.
 */
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Settings } from '../config/settings';
import { isSupabaseConfigured, findUserById } from '../services/supabase';
import { AuthRequest } from './auth';

const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  let decoded: any;
  try {
    decoded = jwt.verify(header.slice(7), Settings.JWT_SECRET);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.userId = decoded.userId;
  req.userEmail = decoded.email;

  let isAdmin = false;

  if (isSupabaseConfigured()) {
    const user = await findUserById(decoded.userId);
    isAdmin = Boolean(user?.is_admin);
  } else {
    isAdmin = decoded.isAdmin === true || adminEmails.includes(String(decoded.email || '').toLowerCase());
  }

  if (!isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}
