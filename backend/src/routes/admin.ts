/**
 * routes/admin.ts
 * OWNS: Administrator endpoints — monitoring, moderation, governance.
 *
 * All routes require `requireAdmin`. Data comes from Supabase when configured;
 * otherwise the in-memory fallback returns best-effort data + a persistence flag
 * so the dashboard still renders in demo mode.
 *
 * GET  /api/admin/summary        → users count, usage, costs, health, metrics
 * GET  /api/admin/users          → list users (latest first)
 * POST /api/admin/users/:id/ban  → { banned: true | false } suspend/restore
 * GET  /api/admin/conversations  → all conversations (admin visibility)
 * GET  /api/admin/logs           → audit + agent logs
 */
import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/admin';
import { AuthRequest } from '../middleware/auth';
import {
  isSupabaseConfigured,
  listUsers,
  setUserBanned,
  getUsageSummary,
  getRecentAuditLogs,
  listAllConversations,
  getAgentLogs,
  recordAudit,
} from '../services/supabase';
import { metrics } from '../services/metrics';
import { Settings } from '../config/settings';
import { pingSupabase } from '../services/supabase';

const router = Router();
router.use(requireAdmin as any);

function clientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
}

// GET /api/admin/summary
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const usage = await getUsageSummary(7);
    const users = await listUsers(1000);
    const supabaseOk = isSupabaseConfigured() ? await pingSupabase() : false;

    const snapshot = metrics.snapshot();
    const mem = process.memoryUsage();

    res.json({
      persisted: isSupabaseConfigured(),
      uptimeSec: snapshot.uptimeSec,
      users: {
        total: users.length,
        admins: users.filter((u: any) => u.is_admin).length,
        banned: users.filter((u: any) => u.banned_until).length,
      },
      usage: {
        total: usage.total,
        byEndpoint: usage.byEndpoint,
        byDay: usage.byDay,
        costUsd: usage.cost,
        avgLatencyMs: usage.avgLatencyMs,
      },
      requests: {
        total: snapshot.totalRequests,
        errors: snapshot.totalErrors,
        errorRate: snapshot.errorRate,
        endpoints: snapshot.endpoints,
      },
      workers: snapshot.workers,
      health: {
        engine: `SAGE v${Settings.APP_VERSION}`,
        model: Settings.DEFAULT_MODEL,
        groq: Settings.validate() ? 'ok' : 'missing',
        supabase: isSupabaseConfigured() ? (supabaseOk ? 'ok' : 'unreachable') : 'unconfigured',
      },
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      },
    });
  } catch (error: any) {
    console.error('Admin summary error:', error);
    res.status(500).json({ error: 'Failed to load admin summary' });
  }
});

// GET /api/admin/users
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const users = await listUsers(500);
    res.json({
      persisted: isSupabaseConfigured(),
      users: users.map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        isAdmin: u.is_admin,
        banned: Boolean(u.banned_until),
        createdAt: u.created_at,
      })),
    });
  } catch (error: any) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// POST /api/admin/users/:id/ban  body: { banned: boolean }
router.post('/users/:id/ban', async (req: AuthRequest, res: Response) => {
  try {
    const { banned } = req.body || {};
    if (typeof banned !== 'boolean') {
      res.status(400).json({ error: 'banned must be a boolean' });
      return;
    }

    const ok = await setUserBanned(req.params.id, banned);
    if (!ok) {
      res.status(404).json({ error: 'User not found or update failed' });
      return;
    }

    await recordAudit({
      actorType: 'user',
      actorId: req.userId,
      action: banned ? 'admin.user_banned' : 'admin.user_unbanned',
      resource: req.params.id,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] as string,
    });

    res.json({ ok: true, id: req.params.id, banned });
  } catch (error: any) {
    console.error('Admin ban error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /api/admin/conversations
router.get('/conversations', async (_req: AuthRequest, res: Response) => {
  try {
    const conversations = await listAllConversations(200);
    res.json({
      persisted: isSupabaseConfigured(),
      conversations: conversations.map((c: any) => ({
        id: c.id,
        title: c.title,
        userId: c.userId,
        messageCount: (c.messages || []).length,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('Admin conversations error:', error);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

// GET /api/admin/logs
router.get('/logs', async (_req: AuthRequest, res: Response) => {
  try {
    const [audit, agent] = await Promise.all([getRecentAuditLogs(100), getAgentLogs(100)]);
    res.json({
      persisted: isSupabaseConfigured(),
      audit: audit.map((l: any) => ({
        id: l.id,
        actorType: l.actor_type,
        actorId: l.actor_id,
        action: l.action,
        resource: l.resource,
        ip: l.ip,
        createdAt: l.created_at,
        metadata: l.metadata,
      })),
      agent: agent.map((l: any) => ({
        id: l.id,
        agent: l.agent,
        status: l.status,
        detail: l.detail,
        durationMs: l.duration_ms,
        createdAt: l.created_at,
      })),
    });
  } catch (error: any) {
    console.error('Admin logs error:', error);
    res.status(500).json({ error: 'Failed to load logs' });
  }
});

export default router;
