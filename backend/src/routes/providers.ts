/**
 * routes/providers.ts
 * OWNS: User provider credential management (Phase 2/3).
 *
 * POST   /api/providers/connect      → register + validate a credential
 * GET    /api/providers              → list (masked — never the key)
 * GET    /api/providers/catalog      → supported provider metadata
 * GET    /api/providers/:id          → single credential (masked)
 * GET    /api/providers/:id/models   → live model discovery
 * POST   /api/providers/:id/health   → validate + refresh status
 * PATCH  /api/providers/:id          → select model / rename / vision flag
 * DELETE /api/providers/:id          → revoke (delete encrypted credential)
 *
 * SECURITY: encrypted keys are never returned; plaintext keys never appear in
 * logs, errors, or responses. All queries are user-scoped.
 */
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { providerService } from '../providers';
import { PROVIDER_CATALOG } from '../providers/adapters';
import { recordAudit } from '../services/supabase';

const router = Router();
router.use(authMiddleware);

function safeError(err: any): string {
  // Handles both Error objects and plain strings. Never surface provider
  // error payloads that could echo the key.
  const msg = String(typeof err === 'string' ? err : err?.message || 'Unknown error').slice(0, 300);
  return msg
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-••••')
    .replace(/gsk_[A-Za-z0-9_-]{8,}/g, 'gsk_••••')
    .replace(/xai-[A-Za-z0-9_-]{8,}/g, 'xai-••••')
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, 'AIza••••');
}

// GET /api/providers/catalog
router.get('/catalog', (_req: AuthRequest, res: Response) => {
  res.json({ providers: PROVIDER_CATALOG });
});

// POST /api/providers/connect
router.post('/connect', async (req: AuthRequest, res: Response) => {
  try {
    const { provider, apiKey, label, baseUrl, model, supportsVision } = req.body || {};

    if (typeof provider !== 'string' || !provider.trim()) {
      res.status(400).json({ error: 'provider is required' });
      return;
    }
    if (apiKey !== undefined && typeof apiKey !== 'string') {
      res.status(400).json({ error: 'apiKey must be a string' });
      return;
    }
    if (apiKey && apiKey.length > 500) {
      res.status(400).json({ error: 'apiKey is too long' });
      return;
    }
    if (baseUrl !== undefined && (typeof baseUrl !== 'string' || baseUrl.length > 500)) {
      res.status(400).json({ error: 'baseUrl must be a string up to 500 chars' });
      return;
    }
    if (label !== undefined && (typeof label !== 'string' || label.length > 80)) {
      res.status(400).json({ error: 'label must be a string up to 80 chars' });
      return;
    }
    if (model !== undefined && (typeof model !== 'string' || model.length > 200)) {
      res.status(400).json({ error: 'model must be a string up to 200 chars' });
      return;
    }

    const result = await providerService.connect(req.userId!, {
      provider: provider.trim(),
      apiKey: apiKey || '',
      label: typeof label === 'string' ? label : undefined,
      baseUrl: typeof baseUrl === 'string' ? baseUrl : undefined,
      model: typeof model === 'string' ? model : undefined,
      supportsVision: supportsVision === true,
    });

    if (!result.ok) {
      res.status(400).json({ error: safeError(result.error) });
      return;
    }

    res.status(201).json({
      credential: result.record,
      models: result.models || [],
      note: 'Your key is encrypted at rest and will never be shown again.',
    });
  } catch (error: any) {
    console.error('Connect provider error:', error);
    res.status(500).json({ error: 'Failed to connect provider' });
  }
});

// GET /api/providers
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const credentials = await providerService.list(req.userId!);
    res.json({ credentials });
  } catch (error: any) {
    console.error('List providers error:', error);
    res.status(500).json({ error: 'Failed to list providers' });
  }
});

// GET /api/providers/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const cred = await providerService.get(req.userId!, req.params.id);
    if (!cred) {
      res.status(404).json({ error: 'Provider credential not found' });
      return;
    }
    res.json({ credential: cred });
  } catch (error: any) {
    console.error('Get provider error:', error);
    res.status(500).json({ error: 'Failed to fetch provider' });
  }
});

// GET /api/providers/:id/models
router.get('/:id/models', async (req: AuthRequest, res: Response) => {
  try {
    const { models, error } = await providerService.listModels(req.userId!, req.params.id);
    if (error && models.length === 0) {
      res.status(404).json({ error: safeError(error) });
      return;
    }
    res.json({ models, error: error ? safeError(error) : undefined });
  } catch (error: any) {
    console.error('List provider models error:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// POST /api/providers/:id/health
router.post('/:id/health', async (req: AuthRequest, res: Response) => {
  try {
    const result = await providerService.healthCheck(req.userId!, req.params.id);
    if (result.error && !result.ok) {
      // Credential not found vs provider down.
      const isMissing = result.error === 'Provider credential not found';
      res.status(isMissing ? 404 : 200).json({
        ok: false,
        error: safeError(result.error),
      });
      return;
    }
    res.json({ ok: true, models: result.models || [] });
  } catch (error: any) {
    console.error('Provider health error:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

// PATCH /api/providers/:id  (model selection / rename / vision flag)
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { model, label, supportsVision } = req.body || {};
    const cred = await providerService.get(req.userId!, req.params.id);
    if (!cred) {
      res.status(404).json({ error: 'Provider credential not found' });
      return;
    }

    const updates: any = {};
    if (model !== undefined) {
      if (typeof model !== 'string' || !model.trim() || model.length > 200) {
        res.status(400).json({ error: 'model must be a non-empty string' });
        return;
      }
      updates.model = model.trim();
    }
    if (label !== undefined) {
      if (typeof label !== 'string' || label.length > 80) {
        res.status(400).json({ error: 'label must be a string up to 80 chars' });
        return;
      }
      updates.label = label.trim();
    }
    if (supportsVision !== undefined) {
      updates.capabilities = { ...(cred.capabilities || {}), vision: supportsVision === true };
    }

    const ok = await providerService.updateCred(req.userId!, req.params.id, updates);
    if (!ok) {
      res.status(500).json({ error: 'Failed to update provider credential' });
      return;
    }
    await recordAudit({ actorType: 'user', actorId: req.userId!, action: 'provider.updated', resource: req.params.id });
    const fresh = await providerService.get(req.userId!, req.params.id);
    res.json({ credential: fresh });
  } catch (error: any) {
    console.error('Update provider error:', error);
    res.status(500).json({ error: 'Failed to update provider credential' });
  }
});

// POST /api/providers/:id/rotate — replace the stored key (validated first)
router.post('/:id/rotate', async (req: AuthRequest, res: Response) => {
  try {
    const { apiKey } = req.body || {};
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      res.status(400).json({ error: 'apiKey is required' });
      return;
    }
    if (apiKey.length > 500) {
      res.status(400).json({ error: 'apiKey is too long' });
      return;
    }

    const result = await providerService.rotateKey(req.userId!, req.params.id, apiKey);
    if (!result.ok) {
      const isMissing = result.error === 'Provider credential not found';
      res.status(isMissing ? 404 : 400).json({ error: safeError(result.error) });
      return;
    }
    res.json({
      credential: result.record,
      note: 'Your new key is encrypted at rest and will never be shown again.',
    });
  } catch (error: any) {
    console.error('Rotate provider key error:', error);
    res.status(500).json({ error: 'Failed to rotate provider credential' });
  }
});

// DELETE /api/providers/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await providerService.revoke(req.userId!, req.params.id);
    if (!result.ok) {
      res.status(404).json({ error: 'Provider credential not found' });
      return;
    }
    res.json({ ok: true, id: req.params.id });
  } catch (error: any) {
    console.error('Revoke provider error:', error);
    res.status(500).json({ error: 'Failed to revoke provider credential' });
  }
});

export default router;
