/**
 * routes/organizations.ts
 * OWNS: Organization endpoints (multi-tenant workspaces).
 *
 * POST   /api/organizations                    → create (plan.gated)
 * GET    /api/organizations                    → list my organizations
 * GET    /api/organizations/:id                → detail + members
 * PATCH  /api/organizations/:id                → rename (owner/admin)
 * POST   /api/organizations/:id/members        → invite by email (owner/admin)
 * DELETE /api/organizations/:id/members/:uid   → remove member (owner/admin)
 * POST   /api/organizations/:id/leave          → leave (owner must transfer/delete)
 * DELETE /api/organizations/:id                → delete (owner only)
 */
import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { isSupabaseConfigured, findUserByEmail, recordAudit } from '../services/supabase';
import { findInMemoryUser } from './auth';
import {
  createOrganization,
  listOrganizationsForUser,
  getOrganization,
  isMember,
  getMemberRole,
  listMembers,
  addMember,
  removeMember,
  updateOrganization,
  deleteOrganization,
  countOrganizationsForUser,
  OrgRole,
} from '../services/organizations';
import { getEffectivePlan } from '../services/billing';

const router = Router();
router.use(authMiddleware);

function clientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
}

/** Owner + admin gate. Returns false and writes the response when denied. */
async function requireManager(
  req: AuthRequest,
  res: Response,
  orgId: string,
  { ownerOnly = false }: { ownerOnly?: boolean } = {}
): Promise<boolean> {
  const role = await getMemberRole(orgId, req.userId!);
  if (!role) {
    res.status(404).json({ error: 'Organization not found' });
    return false;
  }
  if (ownerOnly ? role !== 'owner' : !['owner', 'admin'].includes(role)) {
    res.status(403).json({ error: ownerOnly ? 'Only the organization owner can do this' : 'Admin access required' });
    return false;
  }
  return true;
}

// POST /api/organizations
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body || {};
    if (name !== undefined && typeof name !== 'string') {
      res.status(400).json({ error: 'name must be a string' });
      return;
    }

    // Plan gate: respect maxOrganizations from the user's effective plan.
    const [{ plan }, current] = await Promise.all([
      getEffectivePlan(req.userId!),
      countOrganizationsForUser(req.userId!),
    ]);
    if (current >= plan.maxOrganizations) {
      res.status(429).json({
        error: `Your ${plan.name} plan allows ${plan.maxOrganizations} organization${plan.maxOrganizations === 1 ? '' : 's'}. Upgrade to create more.`,
        upgrade: true,
        plan: plan.id,
      });
      return;
    }

    const org = await createOrganization(req.userId!, name);
    if (!org) {
      res.status(500).json({ error: 'Failed to create organization' });
      return;
    }

    await recordAudit({
      actorType: 'user',
      actorId: req.userId,
      action: 'organization.created',
      resource: org.id,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] as string,
    });

    res.status(201).json(org);
  } catch (error: any) {
    console.error('Create organization error:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// GET /api/organizations
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const orgs = await listOrganizationsForUser(req.userId!);
    const withCounts = await Promise.all(
      orgs.map(async (o) => ({ ...o, memberCount: (await listMembers(o.id)).length }))
    );
    res.json({ organizations: withCounts });
  } catch (error: any) {
    console.error('List organizations error:', error);
    res.status(500).json({ error: 'Failed to list organizations' });
  }
});

// GET /api/organizations/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const org = await getOrganization(req.params.id);
    if (!org || !(await isMember(req.params.id, req.userId!))) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }
    const members = await listMembers(req.params.id);
    res.json({ organization: org, members });
  } catch (error: any) {
    console.error('Get organization error:', error);
    res.status(500).json({ error: 'Failed to get organization' });
  }
});

// PATCH /api/organizations/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body || {};
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (!(await requireManager(req, res, req.params.id))) return;

    const org = await updateOrganization(req.params.id, name);
    if (!org) {
      res.status(500).json({ error: 'Failed to update organization' });
      return;
    }
    res.json(org);
  } catch (error: any) {
    console.error('Update organization error:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// POST /api/organizations/:id/members  body: { email, role? }
router.post('/:id/members', async (req: AuthRequest, res: Response) => {
  try {
    const { email, role } = req.body || {};
    if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      res.status(400).json({ error: 'A valid email is required' });
      return;
    }
    const cleanRole: OrgRole = role === 'admin' ? 'admin' : 'member';

    if (!(await requireManager(req, res, req.params.id))) return;

    // Resolve the invited account: Supabase users table, or demo-mode store.
    const target = isSupabaseConfigured()
      ? await findUserByEmail(email)
      : findInMemoryUser(email);
    if (!target) {
      res.status(404).json({ error: 'No account exists for that email yet' });
      return;
    }

    const ok = await addMember(req.params.id, target.id, cleanRole, email);
    if (!ok) {
      res.status(500).json({ error: 'Failed to add member' });
      return;
    }

    await recordAudit({
      actorType: 'user',
      actorId: req.userId,
      action: 'organization.member_added',
      resource: `${req.params.id}:${target.id}`,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] as string,
    });

    res.status(201).json({ organizationId: req.params.id, userId: target.id, email, role: cleanRole });
  } catch (error: any) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// DELETE /api/organizations/:id/members/:userId
router.delete('/:id/members/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const targetId = req.params.userId;
    if (targetId === req.userId) {
      res.status(400).json({ error: 'Use "leave" to remove yourself' });
      return;
    }
    if (!(await requireManager(req, res, req.params.id))) return;

    const role = await getMemberRole(req.params.id, targetId);
    if (role === 'owner') {
      res.status(403).json({ error: 'Cannot remove the organization owner' });
      return;
    }

    const ok = await removeMember(req.params.id, targetId);
    if (!ok) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// POST /api/organizations/:id/leave
router.post('/:id/leave', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isMember(req.params.id, req.userId!))) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }
    const role = await getMemberRole(req.params.id, req.userId!);
    if (role === 'owner') {
      res.status(400).json({ error: 'Owners cannot leave. Delete the organization or transfer ownership first.' });
      return;
    }
    const ok = await removeMember(req.params.id, req.userId!);
    if (!ok) {
      res.status(500).json({ error: 'Failed to leave organization' });
      return;
    }
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Leave organization error:', error);
    res.status(500).json({ error: 'Failed to leave organization' });
  }
});

// DELETE /api/organizations/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireManager(req, res, req.params.id, { ownerOnly: true }))) return;
    const ok = await deleteOrganization(req.params.id);
    if (!ok) {
      res.status(500).json({ error: 'Failed to delete organization' });
      return;
    }
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Delete organization error:', error);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

export default router;
