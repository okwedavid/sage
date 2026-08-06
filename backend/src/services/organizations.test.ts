/**
 * services/organizations.test.ts — Unit tests for the organizations service
 * (in-memory fallback mode; Supabase env unset).
 */
import { describe, it, expect } from 'vitest';
import {
  slugify,
  createOrganization,
  listOrganizationsForUser,
  getOrganization,
  isMember,
  getMemberRole,
  addMember,
  removeMember,
  updateOrganization,
  deleteOrganization,
  countOrganizationsForUser,
} from './organizations';

describe('slugify', () => {
  it('normalizes names to slugs', () => {
    expect(slugify('Acme Corp')).toBe('acme-corp');
    expect(slugify('  Hello   World!  ')).toBe('hello-world');
    expect(slugify('!!!')).toBe('org');
    expect(slugify('a'.repeat(100)).length).toBeLessThanOrEqual(48);
  });
});

describe('organizations (in-memory mode)', () => {
  it('creates an org owned by the caller with a unique slug', async () => {
    const org = await createOrganization('u-owner', 'Sage Labs');
    expect(org).not.toBeNull();
    expect(org!.ownerId).toBe('u-owner');
    expect(org!.slug).toMatch(/^sage-labs-/);
    expect(await isMember(org!.id, 'u-owner')).toBe(true);
    expect(await getMemberRole(org!.id, 'u-owner')).toBe('owner');
  });

  it('lists only orgs the user belongs to and counts them', async () => {
    const a = await createOrganization('user-a', 'A Org');
    const b = await createOrganization('user-b', 'B Org');

    const aOrgs = await listOrganizationsForUser('user-a');
    expect(aOrgs.map((o) => o.id)).toEqual([a!.id]);
    expect(await countOrganizationsForUser('user-a')).toBe(1);
    expect(await listOrganizationsForUser('user-b')).toHaveLength(1);
    void b;
  });

  it('fetches a single org and rejects lookups by non-members', async () => {
    const org = await createOrganization('owner', 'Fetch Co');
    expect((await getOrganization(org!.id))?.name).toBe('Fetch Co');
    expect(await getOrganization('missing')).toBeNull();
    expect(await isMember(org!.id, 'stranger')).toBe(false);
    expect(await getMemberRole(org!.id, 'stranger')).toBeNull();
  });

  it('adds members (idempotent) and reports failures for missing orgs', async () => {
    const org = await createOrganization('owner', 'Team Co');
    expect(await addMember(org!.id, 'u2', 'member')).toBe(true);
    expect(await addMember(org!.id, 'u2', 'member')).toBe(true); // idempotent
    expect((await listOrganizationsForUser('u2')).map((o) => o.id)).toEqual([org!.id]);
    expect(await addMember('missing-org', 'u3', 'member')).toBe(false);
  });

  it('removes members and reports failures for absent members', async () => {
    const org = await createOrganization('owner', 'Remove Co');
    await addMember(org!.id, 'u2', 'member');
    expect(await removeMember(org!.id, 'u2')).toBe(true);
    expect(await removeMember(org!.id, 'u2')).toBe(false);
    expect(await removeMember(org!.id, 'ghost')).toBe(false);
  });

  it('renames orgs and rejects blank names', async () => {
    const org = await createOrganization('owner', 'Rename Co');
    const renamed = await updateOrganization(org!.id, 'Renamed Co');
    expect(renamed?.name).toBe('Renamed Co');
    expect(await updateOrganization(org!.id, '   ')).toBeNull();
    expect(await updateOrganization('missing', 'x')).toBeNull();
  });

  it('deleting an org removes its members', async () => {
    const org = await createOrganization('owner', 'Delete Co');
    await addMember(org!.id, 'u2', 'member');
    expect(await deleteOrganization(org!.id)).toBe(true);
    expect(await getOrganization(org!.id)).toBeNull();
    expect(await isMember(org!.id, 'u2')).toBe(false);
    expect(await deleteOrganization('missing')).toBe(false);
  });
});
