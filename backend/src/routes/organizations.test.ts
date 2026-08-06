/**
 * routes/organizations.test.ts — Integration tests for organization endpoints.
 * Runs in demo mode (no Supabase): registrations land in the in-memory user
 * store, orgs in the in-memory org store. The Free plan caps orgs at 1.
 */
import { describe, it, expect, vi } from 'vitest';
import { withServer, jsonFetch } from '../test-utils/http';

vi.hoisted(() => {
  process.env.GROQ_API_KEY = 'gsk_test_server_key';
  process.env.JWT_SECRET = 'test-secret-for-org-tests';
  process.env.RATE_LIMIT_MAX = '100000';
});

import app from '../index';

/** Register a fresh account in the in-memory store and return auth headers. */
async function registerUser(
  baseUrl: string,
  email: string
): Promise<{ headers: Record<string, string>; token: string }> {
  const res = await jsonFetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ email, password: 'secret123', name: email.split('@')[0] }),
  });
  expect(res.status).toBe(201);
  return { headers: { Authorization: `Bearer ${res.body.token}` }, token: res.body.token };
}

/** Decode the userId claim from a JWT (tests only — no verification needed). */
function userIdFromToken(token: string): string {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  return payload.userId;
}

describe('organizations require auth', () => {
  it('returns 401 without a token', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/organizations`);
      expect(status).toBe(401);
    });
  });
});

describe('organization CRUD', () => {
  it('creates, lists, fetches, renames, and deletes an organization', async () => {
    await withServer(app, async (baseUrl) => {
      const { headers } = await registerUser(baseUrl, 'owner@org.dev');

      const empty = await jsonFetch(`${baseUrl}/api/organizations`, { headers });
      expect(empty.body.organizations).toEqual([]);

      const created = await jsonFetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Acme Corp' }),
      });
      expect(created.status).toBe(201);
      expect(created.body.name).toBe('Acme Corp');
      expect(created.body.slug).toMatch(/^acme-corp-/);

      const list = await jsonFetch(`${baseUrl}/api/organizations`, { headers });
      expect(list.body.organizations).toHaveLength(1);
      expect(list.body.organizations[0].memberCount).toBe(1);

      const detail = await jsonFetch(`${baseUrl}/api/organizations/${created.body.id}`, { headers });
      expect(detail.status).toBe(200);
      expect(detail.body.organization.ownerId).toBeTruthy();
      expect(detail.body.members).toHaveLength(1);
      expect(detail.body.members[0].role).toBe('owner');

      const renamed = await jsonFetch(`${baseUrl}/api/organizations/${created.body.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name: 'Acme Inc' }),
      });
      expect(renamed.status).toBe(200);
      expect(renamed.body.name).toBe('Acme Inc');

      const del = await jsonFetch(`${baseUrl}/api/organizations/${created.body.id}`, {
        method: 'DELETE',
        headers,
      });
      expect(del.status).toBe(200);
      expect(del.body.ok).toBe(true);

      const gone = await jsonFetch(`${baseUrl}/api/organizations/${created.body.id}`, { headers });
      expect(gone.status).toBe(404);
    });
  });

  it('enforces the Free plan organization limit (1 org)', async () => {
    await withServer(app, async (baseUrl) => {
      const { headers } = await registerUser(baseUrl, 'limit@org.dev');

      const first = await jsonFetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'One' }),
      });
      expect(first.status).toBe(201);

      const second = await jsonFetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Two' }),
      });
      expect(second.status).toBe(429);
      expect(second.body.upgrade).toBe(true);
      expect(second.body.error).toContain('Free');
    });
  });

  it('scopes organizations per user', async () => {
    await withServer(app, async (baseUrl) => {
      const a = await registerUser(baseUrl, 'a@org.dev');
      const b = await registerUser(baseUrl, 'b@org.dev');

      await jsonFetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers: a.headers,
        body: JSON.stringify({ name: "A's org" }),
      });

      const bList = await jsonFetch(`${baseUrl}/api/organizations`, { headers: b.headers });
      expect(bList.body.organizations).toHaveLength(0);
    });
  });

  it('returns 404 for orgs the user does not belong to', async () => {
    await withServer(app, async (baseUrl) => {
      const owner = await registerUser(baseUrl, 'pro@org.dev');
      const stranger = await registerUser(baseUrl, 'stranger@org.dev');

      const org = await jsonFetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers: owner.headers,
        body: JSON.stringify({ name: 'Private' }),
      });

      const peek = await jsonFetch(`${baseUrl}/api/organizations/${org.body.id}`, {
        headers: stranger.headers,
      });
      expect(peek.status).toBe(404);
    });
  });

  it('validates input: non-string name on create, missing name on rename', async () => {
    await withServer(app, async (baseUrl) => {
      const { headers } = await registerUser(baseUrl, 'valid@org.dev');

      const badName = await jsonFetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 42 }),
      });
      expect(badName.status).toBe(400);

      const org = await jsonFetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Valid Co' }),
      });
      expect(org.status).toBe(201);

      const badRename = await jsonFetch(`${baseUrl}/api/organizations/${org.body.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({}),
      });
      expect(badRename.status).toBe(400);
    });
  });

  it('only the owner can delete; non-owners get 403', async () => {
    await withServer(app, async (baseUrl) => {
      const owner = await registerUser(baseUrl, 'own@del.dev');
      const admin = await registerUser(baseUrl, 'admin@del.dev');

      const org = await jsonFetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers: owner.headers,
        body: JSON.stringify({ name: 'Owned' }),
      });
      const orgId = org.body.id;

      // Promote a member to admin.
      await jsonFetch(`${baseUrl}/api/organizations/${orgId}/members`, {
        method: 'POST',
        headers: owner.headers,
        body: JSON.stringify({ email: 'admin@del.dev', role: 'admin' }),
      });

      const adminDelete = await jsonFetch(`${baseUrl}/api/organizations/${orgId}`, {
        method: 'DELETE',
        headers: admin.headers,
      });
      expect(adminDelete.status).toBe(403);
      expect(adminDelete.body.error).toContain('owner');

      const ownerDelete = await jsonFetch(`${baseUrl}/api/organizations/${orgId}`, {
        method: 'DELETE',
        headers: owner.headers,
      });
      expect(ownerDelete.status).toBe(200);
    });
  });

  it('validates invitations and 404s for non-member removals', async () => {
    await withServer(app, async (baseUrl) => {
      const owner = await registerUser(baseUrl, 'own@inv.dev');

      const org = await jsonFetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers: owner.headers,
        body: JSON.stringify({ name: 'Invite Co' }),
      });
      const orgId = org.body.id;

      const badEmail = await jsonFetch(`${baseUrl}/api/organizations/${orgId}/members`, {
        method: 'POST',
        headers: owner.headers,
        body: JSON.stringify({ email: 'not-an-email' }),
      });
      expect(badEmail.status).toBe(400);

      const removeGhost = await jsonFetch(`${baseUrl}/api/organizations/${orgId}/members/nonexistent-user`, {
        method: 'DELETE',
        headers: owner.headers,
      });
      expect(removeGhost.status).toBe(404);
    });
  });
});

describe('membership', () => {
  it('invites a registered user by email and the member appears in the org', async () => {
    await withServer(app, async (baseUrl) => {
      const owner = await registerUser(baseUrl, 'boss@team.dev');
      const worker = await registerUser(baseUrl, 'worker@team.dev');

      const org = await jsonFetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers: owner.headers,
        body: JSON.stringify({ name: 'Team HQ' }),
      });
      const orgId = org.body.id;

      let detail = await jsonFetch(`${baseUrl}/api/organizations/${orgId}`, { headers: owner.headers });
      expect(detail.body.members).toHaveLength(1);

      const invite = await jsonFetch(`${baseUrl}/api/organizations/${orgId}/members`, {
        method: 'POST',
        headers: owner.headers,
        body: JSON.stringify({ email: 'worker@team.dev', role: 'member' }),
      });
      expect(invite.status).toBe(201);
      expect(invite.body.role).toBe('member');
      expect(invite.body.userId).toBe(userIdFromToken(worker.token));

      detail = await jsonFetch(`${baseUrl}/api/organizations/${orgId}`, { headers: owner.headers });
      expect(detail.body.members).toHaveLength(2);

      // Unknown email → 404, no silent membership.
      const badInvite = await jsonFetch(`${baseUrl}/api/organizations/${orgId}/members`, {
        method: 'POST',
        headers: owner.headers,
        body: JSON.stringify({ email: 'ghost@team.dev' }),
      });
      expect(badInvite.status).toBe(404);

      // The invited worker now sees the org.
      const workerList = await jsonFetch(`${baseUrl}/api/organizations`, { headers: worker.headers });
      expect(workerList.body.organizations.map((o: any) => o.id)).toContain(orgId);
    });
  });

  it('owner can remove a member; members cannot manage the org', async () => {
    await withServer(app, async (baseUrl) => {
      const owner = await registerUser(baseUrl, 'ceo@rm.dev');
      const worker = await registerUser(baseUrl, 'emp@rm.dev');

      const org = await jsonFetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers: owner.headers,
        body: JSON.stringify({ name: 'Remove Co' }),
      });
      const orgId = org.body.id;

      await jsonFetch(`${baseUrl}/api/organizations/${orgId}/members`, {
        method: 'POST',
        headers: owner.headers,
        body: JSON.stringify({ email: 'emp@rm.dev' }),
      });

      // A member cannot invite others (403).
      const memberInvite = await jsonFetch(`${baseUrl}/api/organizations/${orgId}/members`, {
        method: 'POST',
        headers: worker.headers,
        body: JSON.stringify({ email: 'nobody@rm.dev' }),
      });
      expect(memberInvite.status).toBe(403);

      // Resolve the worker's userId from the member list, then remove.
      const detail = await jsonFetch(`${baseUrl}/api/organizations/${orgId}`, { headers: owner.headers });
      const workerMember = detail.body.members.find((m: any) => m.userId === userIdFromToken(worker.token));
      expect(workerMember).toBeDefined();

      const remove = await jsonFetch(`${baseUrl}/api/organizations/${orgId}/members/${workerMember.userId}`, {
        method: 'DELETE',
        headers: owner.headers,
      });
      expect(remove.status).toBe(200);
      expect(remove.body.ok).toBe(true);

      // Worker no longer sees the org.
      const workerList = await jsonFetch(`${baseUrl}/api/organizations`, { headers: worker.headers });
      expect(workerList.body.organizations).toHaveLength(0);
    });
  });

  it('members can leave; owners cannot', async () => {
    await withServer(app, async (baseUrl) => {
      const owner = await registerUser(baseUrl, 'lead@leave.dev');
      const worker = await registerUser(baseUrl, 'dev@leave.dev');

      const org = await jsonFetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers: owner.headers,
        body: JSON.stringify({ name: 'Leave Co' }),
      });
      const orgId = org.body.id;

      await jsonFetch(`${baseUrl}/api/organizations/${orgId}/members`, {
        method: 'POST',
        headers: owner.headers,
        body: JSON.stringify({ email: 'dev@leave.dev' }),
      });

      const ownerLeave = await jsonFetch(`${baseUrl}/api/organizations/${orgId}/leave`, {
        method: 'POST',
        headers: owner.headers,
      });
      expect(ownerLeave.status).toBe(400);

      const workerLeave = await jsonFetch(`${baseUrl}/api/organizations/${orgId}/leave`, {
        method: 'POST',
        headers: worker.headers,
      });
      expect(workerLeave.status).toBe(200);

      const workerList = await jsonFetch(`${baseUrl}/api/organizations`, { headers: worker.headers });
      expect(workerList.body.organizations).toHaveLength(0);
    });
  });
});
