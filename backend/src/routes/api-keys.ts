/**
 * routes/api-keys.ts
 * OWNS: API key management endpoints (JWT-authenticated users manage their keys)
 *
 * POST   /api/keys          → create (plaintext returned ONCE)
 * GET    /api/keys          → list (suffix only)
 * POST   /api/keys/:id/rotate  → rotate (new plaintext returned once)
 * DELETE /api/keys/:id      → revoke
 */
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  createKey,
  listKeys,
  revokeKey,
  rotateKey,
} from '../services/api-keys';
import { isSupabaseConfigured, recordAudit } from '../services/supabase';

const router = Router();
router.use(authMiddleware);

const SUPPORTED_SCOPES = ['chat', 'conversations', 'admin'];

// GET /api/keys
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const keys = await listKeys(req.userId!);
    res.json({
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        suffix: k.keySuffix,
        scopes: k.scopes,
        quotaPerDay: k.quotaPerDay,
        requestsToday: k.requestsToday,
        status: k.status,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
        expiresAt: k.expiresAt,
      })),
    });
  } catch (error: any) {
    console.error('List keys error:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// POST /api/keys
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, scopes, quotaPerDay, expiresAt } = req.body || {};

    if (scopes && (!Array.isArray(scopes) || scopes.some((s) => !SUPPORTED_SCOPES.includes(s)))) {
      res.status(400).json({ error: `Scopes must be a subset of: ${SUPPORTED_SCOPES.join(', ')}` });
      return;
    }
    if (quotaPerDay !== undefined && (typeof quotaPerDay !== 'number' || quotaPerDay < 1 || quotaPerDay > 1_000_000)) {
      res.status(400).json({ error: 'quotaPerDay must be between 1 and 1,000,000' });
      return;
    }
    if (name && typeof name !== 'string') {
      res.status(400).json({ error: 'name must be a string' });
      return;
    }

    const created = await createKey({
      userId: req.userId!,
      name,
      scopes,
      quotaPerDay,
      expiresAt,
    });

    if (!created) {
      res.status(500).json({ error: 'Failed to create API key' });
      return;
    }

    // The ONLY time the plaintext is ever returned.
    await recordAudit({
      actorType: 'user',
      actorId: req.userId!,
      action: 'api_key.created',
      resource: created.record.id,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || '',
      userAgent: req.headers['user-agent'] as string,
    });

    res.status(201).json({
      key: created.plaintext,
      id: created.record.id,
      name: created.record.name,
      scopes: created.record.scopes,
      quotaPerDay: created.record.quotaPerDay,
      suffix: created.record.keySuffix,
      note: 'Store this key now — it will never be shown again.',
    });
  } catch (error: any) {
    console.error('Create key error:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// POST /api/keys/:id/rotate
router.post('/:id/rotate', async (req: AuthRequest, res: Response) => {
  try {
    const { name, scopes, quotaPerDay } = req.body || {};

    if (scopes && (!Array.isArray(scopes) || scopes.some((s) => !SUPPORTED_SCOPES.includes(s)))) {
      res.status(400).json({ error: `Scopes must be a subset of: ${SUPPORTED_SCOPES.join(', ')}` });
      return;
    }

    const rotated = await rotateKey(req.userId!, req.params.id, { name, scopes, quotaPerDay });
    if (!rotated) {
      res.status(404).json({ error: 'Active API key not found' });
      return;
    }

    res.json({
      key: rotated.plaintext,
      id: rotated.record.id,
      name: rotated.record.name,
      note: 'The previous key has been revoked. Store this new key now.',
    });
  } catch (error: any) {
    console.error('Rotate key error:', error);
    res.status(500).json({ error: 'Failed to rotate API key' });
  }
});

// DELETE /api/keys/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ok = await revokeKey(req.userId!, req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'API key not found' });
      return;
    }
    res.json({ ok: true, id: req.params.id });
  } catch (error: any) {
    console.error('Revoke key error:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

export default router;
