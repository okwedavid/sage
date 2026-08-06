/**
 * middleware/api-key.ts
 * OWNS: API key authentication middleware (machine-to-machine access).
 *
 * Accepts `Authorization: Bearer sk_sage_...` keys. On success:
 *   - req.apiKey   = the ApiKeyRecord
 *   - req.userId   = key owner id (so downstream JWT-based logic keeps working)
 * On failure: 401 (invalid/revoked/expired) or 429 (daily quota exceeded).
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateKey, scopeAllows, isApiKeyFormat } from '../services/api-keys';
import { recordUsage } from '../services/supabase';
import { Settings } from '../config/settings';
import { AuthRequest } from './auth';

export interface ApiKeyRequest extends Request {
  userId?: string;
  userEmail?: string;
  apiKey?: {
    id: string;
    userId: string;
    scopes: string[];
  };
}

export function requireApiKey(requiredScope = 'chat') {
  return async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';

    if (!isApiKeyFormat(token)) {
      res.status(401).json({ error: 'A valid API key is required (Authorization: Bearer sk_sage_...)' });
      return;
    }

    const auth = await authenticateKey(token);
    if (!auth) {
      res.status(401).json({ error: 'Invalid, revoked, or expired API key' });
      return;
    }

    if (auth.quotaExceeded) {
      res.status(429).json({ error: 'Daily quota exceeded for this API key' });
      return;
    }

    if (!scopeAllows(auth.record, requiredScope)) {
      res.status(403).json({ error: `This API key lacks the required scope: ${requiredScope}` });
      return;
    }

    req.apiKey = { id: auth.record.id, userId: auth.record.userId, scopes: auth.record.scopes };
    req.userId = auth.record.userId;

    // Fire-and-forget usage tracking (never blocks the request path).
    recordUsage({
      userId: auth.record.userId,
      apiKeyId: auth.record.id,
      endpoint: req.originalUrl.split('?')[0],
      method: req.method,
      statusCode: 200,
    });

    next();
  };
}

/**
 * Combined auth: accepts EITHER a JWT (web app users) OR an API key
 * (machine clients). Whichever is present and valid wins. Used by the
 * chat endpoint so both first-class clients can call the same API.
 */
export function jwtOrApiKey(req: AuthRequest & ApiKeyRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (isApiKeyFormat(token)) {
    // Delegate API-key auth to the same logic as requireApiKey.
    authenticateKey(token)
      .then((auth) => {
        if (auth && !auth.quotaExceeded) {
          req.apiKey = { id: auth.record.id, userId: auth.record.userId, scopes: auth.record.scopes };
          req.userId = auth.record.userId;
          recordUsage({
            userId: auth.record.userId,
            apiKeyId: auth.record.id,
            endpoint: req.originalUrl.split('?')[0],
            method: req.method,
            statusCode: 200,
          });
        }
        next();
      })
      .catch(() => next());
    return;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, Settings.JWT_SECRET) as { userId: string; email: string };
      req.userId = decoded.userId;
      req.userEmail = decoded.email;
    } catch {
      // Invalid token — proceed unauthenticated; rate limits still apply.
    }
  }
  next();
}
