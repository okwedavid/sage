/**
 * services/organizations.ts
 * OWNS: Organization & membership persistence (multi-tenant workspaces).
 *
 * Persistence: Supabase when configured (`organizations` +
 * `organization_members` tables); in-memory Map otherwise so demo runs work.
 * Roles: owner > admin > member. Only the owner may delete an organization;
 * owners/admins may manage members.
 */
import { v4 as uuidv4 } from 'uuid';
import { isSupabaseConfigured, getSupabase } from './supabase';

export type OrgRole = 'owner' | 'admin' | 'member';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  organizationId: string;
  userId: string;
  email?: string;
  name?: string;
  role: OrgRole;
  createdAt: string;
}

/** 'Acme Corp' → 'acme-corp'. Non-word chars become dashes, collapsed. */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'org';
}

// ── In-memory fallback state ─────────────────────────────────────────────────
const memOrgs = new Map<string, Organization>();
const memMembers = new Map<string, OrganizationMember>(); // `${orgId}:${userId}`

function memberKey(orgId: string, userId: string): string {
  return `${orgId}:${userId}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase primitives
// ─────────────────────────────────────────────────────────────────────────────

async function dbCreateOrganization(ownerId: string, name: string, slug: string): Promise<Organization | null> {
  const db = getSupabase();
  if (!db) return null;

  const { data, error } = await db
    .from('organizations')
    .insert({ name, slug, owner_id: ownerId })
    .select('*')
    .single();
  if (error) {
    console.error('Failed to create organization:', error.message);
    return null;
  }

  const { error: memberError } = await db.from('organization_members').insert({
    organization_id: data.id,
    user_id: ownerId,
    role: 'owner',
  });
  if (memberError) {
    // Roll back the org row so a failed owner membership never strands an org.
    await db.from('organizations').delete().eq('id', data.id);
    console.error('Failed to add owner membership:', memberError.message);
    return null;
  }

  return toOrganization(data);
}

function toOrganization(row: any): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API (persistence-agnostic)
// ─────────────────────────────────────────────────────────────────────────────

export async function createOrganization(ownerId: string, name: string): Promise<Organization | null> {
  const cleanName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 120) : 'My Organization';
  const slug = `${slugify(cleanName)}-${uuidv4().slice(0, 6)}`;

  if (isSupabaseConfigured()) {
    return dbCreateOrganization(ownerId, cleanName, slug);
  }

  const org: Organization = {
    id: uuidv4(),
    name: cleanName,
    slug,
    ownerId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  memOrgs.set(org.id, org);
  memMembers.set(memberKey(org.id, ownerId), {
    organizationId: org.id,
    userId: ownerId,
    role: 'owner',
    createdAt: org.createdAt,
  });
  return org;
}

/** Organizations the user belongs to (membership). */
export async function listOrganizationsForUser(userId: string): Promise<Organization[]> {
  if (isSupabaseConfigured()) {
    const db = getSupabase();
    if (!db) return [];
    const { data, error } = await db
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId);
    if (error) {
      console.error('Failed to list orgs:', error.message);
      return [];
    }
    const ids = (data || []).map((m: any) => m.organization_id);
    if (ids.length === 0) return [];
    const { data: orgs, error: orgError } = await db
      .from('organizations')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: true });
    if (orgError) {
      console.error('Failed to fetch orgs:', orgError.message);
      return [];
    }
    return (orgs || []).map(toOrganization);
  }

  return Array.from(memOrgs.values()).filter((o) => memMembers.has(memberKey(o.id, userId)));
}

export async function getOrganization(orgId: string): Promise<Organization | null> {
  if (isSupabaseConfigured()) {
    const db = getSupabase();
    if (!db) return null;
    const { data, error } = await db.from('organizations').select('*').eq('id', orgId).maybeSingle();
    if (error) {
      console.error('Failed to fetch organization:', error.message);
      return null;
    }
    return data ? toOrganization(data) : null;
  }
  return memOrgs.get(orgId) || null;
}

export async function isMember(orgId: string, userId: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const db = getSupabase();
    if (!db) return false;
    const { data, error } = await db
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();
    return !error && Boolean(data);
  }
  return memMembers.has(memberKey(orgId, userId));
}

export async function getMemberRole(orgId: string, userId: string): Promise<OrgRole | null> {
  if (isSupabaseConfigured()) {
    const db = getSupabase();
    if (!db) return null;
    const { data, error } = await db
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();
    return !error && data ? (data.role as OrgRole) : null;
  }
  return memMembers.get(memberKey(orgId, userId))?.role || null;
}

export async function listMembers(orgId: string): Promise<OrganizationMember[]> {
  if (isSupabaseConfigured()) {
    const db = getSupabase();
    if (!db) return [];
    // Join with users for email/name display (users may not exist for
    // JWT-only demo users, hence outer-ish left join semantics via select).
    const { data, error } = await db
      .from('organization_members')
      .select('organization_id, user_id, role, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Failed to list members:', error.message);
      return [];
    }
    // Resolve display fields best-effort (batch lookup).
    const userIds = [...new Set((data || []).map((m: any) => m.user_id))];
    const nameByUser = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: users } = await db.from('users').select('id, email, name').in('id', userIds);
      for (const u of users || []) nameByUser.set(u.id, u.name || u.email);
    }
    return (data || []).map((m: any) => ({
      organizationId: m.organization_id,
      userId: m.user_id,
      name: nameByUser.get(m.user_id),
      role: m.role as OrgRole,
      createdAt: m.created_at,
    }));
  }

  return Array.from(memMembers.values())
    .filter((m) => m.organizationId === orgId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Add a member by userId (email resolution happens at the route layer). */
export async function addMember(orgId: string, userId: string, role: OrgRole, email?: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const db = getSupabase();
    if (!db) return false;
    const { error } = await db.from('organization_members').upsert(
      { organization_id: orgId, user_id: userId, role },
      { onConflict: 'organization_id,user_id' }
    );
    if (error) {
      console.error('Failed to add member:', error.message);
      return false;
    }
    return true;
  }

  const org = memOrgs.get(orgId);
  if (!org) return false;
  if (memMembers.has(memberKey(orgId, userId))) return true; // idempotent
  memMembers.set(memberKey(orgId, userId), {
    organizationId: orgId,
    userId,
    email,
    role,
    createdAt: new Date().toISOString(),
  });
  return true;
}

export async function removeMember(orgId: string, userId: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const db = getSupabase();
    if (!db) return false;
    const { error } = await db
      .from('organization_members')
      .delete()
      .eq('organization_id', orgId)
      .eq('user_id', userId);
    if (error) {
      console.error('Failed to remove member:', error.message);
      return false;
    }
    return true;
  }
  return memMembers.delete(memberKey(orgId, userId));
}

export async function updateOrganization(orgId: string, name: string): Promise<Organization | null> {
  const cleanName = name.trim().slice(0, 120);
  if (!cleanName) return null;

  if (isSupabaseConfigured()) {
    const db = getSupabase();
    if (!db) return null;
    const { data, error } = await db
      .from('organizations')
      .update({ name: cleanName })
      .eq('id', orgId)
      .select('*')
      .single();
    if (error) {
      console.error('Failed to update organization:', error.message);
      return null;
    }
    return toOrganization(data);
  }

  const org = memOrgs.get(orgId);
  if (!org) return null;
  org.name = cleanName;
  org.updatedAt = new Date().toISOString();
  return { ...org };
}

export async function deleteOrganization(orgId: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const db = getSupabase();
    if (!db) return false;
    const { error } = await db.from('organizations').delete().eq('id', orgId);
    if (error) {
      console.error('Failed to delete organization:', error.message);
      return false;
    }
    return true;
  }
  // Cascade members, then the org row.
  for (const key of Array.from(memMembers.keys())) {
    if (key.startsWith(`${orgId}:`)) memMembers.delete(key);
  }
  return memOrgs.delete(orgId);
}

/** Count the user's org memberships (used to enforce plan.maxOrganizations). */
export async function countOrganizationsForUser(userId: string): Promise<number> {
  return (await listOrganizationsForUser(userId)).length;
}
