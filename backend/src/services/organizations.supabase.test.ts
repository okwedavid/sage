/**
 * services/organizations.supabase.test.ts — Supabase-mode tests for the
 * organizations service. Mocks the supabase module with a chainable query
 * builder so the DB-backed code paths are exercised (org + member queries).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    tables: {} as Record<string, { data?: any; error?: any }>,
  },
}));

vi.mock('../services/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({
    from: (table: string) => makeBuilder(table),
  }),
}));

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
} from './organizations';

function makeBuilder(table: string) {
  const cfg = mockDb.tables[table] || { data: null, error: null };
  const methods = ['select', 'eq', 'in', 'order', 'limit', 'maybeSingle', 'single'];
  const builder: any = {};
  for (const m of methods) builder[m] = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.upsert = vi.fn(() => builder);
  builder.then = (resolve: (v: any) => void) =>
    resolve({ data: cfg.data, error: cfg.error || null });
  return builder;
}

const ORG_ROW = { id: 'org-1', name: 'Acme', slug: 'acme-1', owner_id: 'u1', created_at: 't', updated_at: 't' };

beforeEach(() => {
  mockDb.tables = {};
});

describe('createOrganization (Supabase mode)', () => {
  it('inserts the org and the owner membership', async () => {
    mockDb.tables['organizations'] = { data: ORG_ROW };
    mockDb.tables['organization_members'] = { data: { organization_id: 'org-1', user_id: 'u1' } };

    const org = await createOrganization('u1', 'Acme');
    expect(org).not.toBeNull();
    expect(org!.name).toBe('Acme');
    expect(org!.ownerId).toBe('u1');
  });

  it('rolls back the org when the owner membership insert fails', async () => {
    mockDb.tables['organizations'] = { data: ORG_ROW };
    mockDb.tables['organization_members'] = { error: new Error('member insert failed') };

    const org = await createOrganization('u1', 'Acme');
    expect(org).toBeNull();
  });
});

describe('listOrganizationsForUser (Supabase mode)', () => {
  it('resolves memberships to organization rows', async () => {
    mockDb.tables['organization_members'] = { data: [{ organization_id: 'org-1' }, { organization_id: 'org-2' }] };
    mockDb.tables['organizations'] = { data: [ORG_ROW, { ...ORG_ROW, id: 'org-2' }] };

    const orgs = await listOrganizationsForUser('u1');
    expect(orgs).toHaveLength(2);
    expect(orgs.map((o) => o.id)).toEqual(['org-1', 'org-2']);
  });

  it('returns [] when the user belongs to no organizations', async () => {
    mockDb.tables['organization_members'] = { data: [] };

    expect(await listOrganizationsForUser('nobody')).toEqual([]);
  });
});

describe('lookups (Supabase mode)', () => {
  it('fetches a single organization', async () => {
    mockDb.tables['organizations'] = { data: ORG_ROW };
    const org = await getOrganization('org-1');
    expect(org?.slug).toBe('acme-1');
  });

  it('isMember reflects membership rows', async () => {
    mockDb.tables['organization_members'] = { data: { user_id: 'u1' } };
    expect(await isMember('org-1', 'u1')).toBe(true);

    mockDb.tables['organization_members'] = { data: null };
    expect(await isMember('org-1', 'stranger')).toBe(false);
  });

  it('getMemberRole returns the role or null', async () => {
    mockDb.tables['organization_members'] = { data: { role: 'admin' } };
    expect(await getMemberRole('org-1', 'u1')).toBe('admin');

    mockDb.tables['organization_members'] = { data: null };
    expect(await getMemberRole('org-1', 'u1')).toBeNull();
  });

  it('lists members with resolved names', async () => {
    mockDb.tables['organization_members'] = {
      data: [
        { organization_id: 'org-1', user_id: 'u1', role: 'owner', created_at: 't1' },
        { organization_id: 'org-1', user_id: 'u2', role: 'member', created_at: 't2' },
      ],
    };
    mockDb.tables['users'] = { data: [{ id: 'u1', name: 'Boss', email: 'b@s.io' }] };

    const members = await listMembers('org-1');
    expect(members).toHaveLength(2);
    expect(members[0].role).toBe('owner');
    // u1 resolved by name; u2 has no users row → name undefined.
    expect(members.find((m) => m.userId === 'u1')?.name).toBe('Boss');
    expect(members.find((m) => m.userId === 'u2')?.name).toBeUndefined();
  });

  it('counts organizations for a user', async () => {
    mockDb.tables['organization_members'] = { data: [{ organization_id: 'a' }, { organization_id: 'b' }] };
    mockDb.tables['organizations'] = { data: [{ id: 'a' }, { id: 'b' }] };
    expect(await countOrganizationsForUser('u1')).toBe(2);
  });
});

describe('mutations (Supabase mode)', () => {
  it('adds a member (idempotent upsert)', async () => {
    mockDb.tables['organization_members'] = { data: { organization_id: 'org-1', user_id: 'u2' } };
    expect(await addMember('org-1', 'u2', 'member')).toBe(true);
  });

  it('reports failure when the member insert errors', async () => {
    mockDb.tables['organization_members'] = { error: new Error('fk violation') };
    expect(await addMember('org-1', 'u2', 'member')).toBe(false);
  });

  it('removes a member', async () => {
    mockDb.tables['organization_members'] = { data: null, error: null };
    expect(await removeMember('org-1', 'u2')).toBe(true);
  });

  it('updates the organization name', async () => {
    mockDb.tables['organizations'] = { data: { ...ORG_ROW, name: 'Acme Inc' } };
    const org = await updateOrganization('org-1', 'Acme Inc');
    expect(org?.name).toBe('Acme Inc');
  });

  it('deletes the organization', async () => {
    mockDb.tables['organizations'] = { data: null, error: null };
    expect(await deleteOrganization('org-1')).toBe(true);
  });
});
