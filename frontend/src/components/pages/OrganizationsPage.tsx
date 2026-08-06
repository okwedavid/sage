/**
 * components/pages/OrganizationsPage.tsx — Multi-tenant workspaces
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Plus,
  Users,
  Mail,
  Trash2,
  LogOut,
  Pencil,
  Crown,
  Shield,
  User as UserIcon,
  UserPlus,
  X,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';

interface Org {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  memberCount: number;
  createdAt: string;
}

interface Member {
  organizationId: string;
  userId: string;
  name?: string;
  email?: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string;
}

export function OrganizationsPage() {
  const { user } = useAppStore();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Expanded org detail
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, Member[]>>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');

  const load = useCallback(async () => {
    try {
      const res = await api.listOrganizations();
      setOrgs(res.organizations || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3000);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      await api.createOrganization(newName.trim());
      setNewName('');
      await load();
      flash('Organization created');
    } catch (e: any) {
      setError(e.message || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  const openOrg = async (id: string) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    if (next && !members[next]) {
      try {
        const res = await api.getOrganization(next);
        setMembers((m) => ({ ...m, [next]: res.members || [] }));
      } catch {
        /* detail will retry on next open */
      }
    }
  };

  const handleInvite = async (orgId: string) => {
    if (!inviteEmail.trim()) return;
    setError('');
    try {
      await api.inviteMember(orgId, inviteEmail.trim(), inviteRole);
      setInviteEmail('');
      const res = await api.getOrganization(orgId);
      setMembers((m) => ({ ...m, [orgId]: res.members || [] }));
      flash('Member invited');
    } catch (e: any) {
      setError(e.message || 'Failed to invite member');
    }
  };

  const handleRemove = async (orgId: string, userId: string) => {
    try {
      await api.removeMember(orgId, userId);
      const res = await api.getOrganization(orgId);
      setMembers((m) => ({ ...m, [orgId]: res.members || [] }));
      await load();
      flash('Member removed');
    } catch (e: any) {
      setError(e.message || 'Failed to remove member');
    }
  };

  const handleRename = async (org: Org) => {
    const name = window.prompt('Organization name', org.name);
    if (!name || name.trim() === org.name) return;
    try {
      await api.renameOrganization(org.id, name.trim());
      await load();
      flash('Organization renamed');
    } catch (e: any) {
      setError(e.message || 'Failed to rename organization');
    }
  };

  const handleLeave = async (org: Org) => {
    if (!window.confirm(`Leave "${org.name}"?`)) return;
    try {
      await api.leaveOrganization(org.id);
      await load();
      flash('You left the organization');
    } catch (e: any) {
      setError(e.message || 'Failed to leave organization');
    }
  };

  const handleDelete = async (org: Org) => {
    if (!window.confirm(`Delete "${org.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteOrganization(org.id);
      setExpandedId(null);
      await load();
      flash('Organization deleted');
    } catch (e: any) {
      setError(e.message || 'Failed to delete organization');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-txt-primary mb-2">Organizations</h1>
          <p className="text-txt-secondary text-sm">
            Multi-tenant workspaces for teams building on SAGE. Your Free plan includes{' '}
            <span className="text-txt-primary font-medium">1 organization</span>.
          </p>
        </div>
      </motion.div>

      {/* Notices */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-3.5 rounded-xl bg-status-success/10 border border-status-success/30 text-status-success text-sm"
          >
            ✓ {notice}
          </motion.div>
        )}
      </AnimatePresence>
      {error && (
        <div className="p-3.5 rounded-xl bg-status-error/10 border border-status-error/30 text-status-error text-sm flex items-center gap-2">
          <X className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Create */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-txt-secondary uppercase tracking-wider mb-1.5 block">
              New organization
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. Acme Corp"
              className="w-full h-11 px-4 rounded-xl bg-sage-input border border-sage-border text-txt-primary text-sm placeholder:text-txt-muted focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all"
            />
          </div>
          <div className="sm:self-end">
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="btn-primary py-3 px-5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Organization
            </button>
          </div>
        </div>
      </motion.div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-txt-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading organizations…
        </div>
      ) : orgs.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow-md">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h3 className="font-display text-lg font-bold text-txt-primary mb-1">No organizations yet</h3>
          <p className="text-sm text-txt-muted max-w-sm mx-auto">
            Create your first workspace to invite teammates and build together on SAGE.
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orgs.map((org, i) => (
            <motion.div
              key={org.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i }}
              className="glass-card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display font-bold text-txt-primary truncate">{org.name}</h3>
                    <div className="flex items-center gap-2 text-[11px] text-txt-muted font-mono">
                      <span>{org.slug}</span>
                      {org.ownerId === user?.id && (
                        <span className="flex items-center gap-0.5 text-accent-tertiary">
                          <Crown className="w-3 h-3" /> Owner
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleRename(org)} title="Rename" className="p-2 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-sage-hover transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {org.ownerId === user?.id ? (
                    <button onClick={() => handleDelete(org)} title="Delete" className="p-2 rounded-lg text-txt-muted hover:text-status-error hover:bg-sage-hover transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={() => handleLeave(org)} title="Leave" className="p-2 rounded-lg text-txt-muted hover:text-status-error hover:bg-sage-hover transition-colors">
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => openOrg(org.id)}
                className="mt-4 w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-sage-input/60 border border-sage-border text-sm text-txt-secondary hover:border-accent-primary/40 hover:text-txt-primary transition-all"
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {org.memberCount} member{org.memberCount === 1 ? '' : 's'}
                </span>
                <span className="text-xs text-accent-primary">{expandedId === org.id ? 'Hide' : 'Manage'}</span>
              </button>

              <AnimatePresence>
                {expandedId === org.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-4 pt-4 border-t border-sage-border space-y-3">
                      {/* Invite */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1 relative">
                          <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
                          <input
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleInvite(org.id)}
                            placeholder="teammate@email.com"
                            className="w-full h-10 pl-9 pr-3 rounded-lg bg-sage-input border border-sage-border text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent-primary transition-all"
                          />
                        </div>
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
                          className="h-10 px-3 rounded-lg bg-sage-input border border-sage-border text-sm text-txt-primary focus:outline-none cursor-pointer"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          onClick={() => handleInvite(org.id)}
                          className="h-10 px-4 rounded-lg bg-gradient-button text-white text-sm font-semibold flex items-center gap-1.5 hover:shadow-glow-sm transition-all disabled:opacity-50"
                          disabled={!inviteEmail.trim()}
                        >
                          <UserPlus className="w-4 h-4" /> Invite
                        </button>
                      </div>

                      {/* Members */}
                      <div className="space-y-1.5">
                        {(members[org.id] || []).map((m) => (
                          <div key={m.userId} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sage-card/50 border border-sage-border/50">
                            <div className="w-7 h-7 rounded-lg bg-gradient-secondary flex items-center justify-center text-white text-xs font-bold">
                              {(m.name || m.email || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-txt-primary truncate flex items-center gap-1.5">
                                {m.name || 'Member'}
                                {m.role === 'owner' && <Crown className="w-3 h-3 text-accent-tertiary" />}
                                {m.role === 'admin' && <Shield className="w-3 h-3 text-accent-secondary" />}
                              </div>
                              {m.email && <div className="text-[11px] text-txt-muted truncate">{m.email}</div>}
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-sage-input text-txt-secondary">
                              {m.role}
                            </span>
                            {m.userId !== user?.id && m.role !== 'owner' && (
                              <button
                                onClick={() => handleRemove(org.id, m.userId)}
                                title="Remove member"
                                className="p-1.5 rounded-md text-txt-muted hover:text-status-error hover:bg-sage-hover transition-colors"
                              >
                                <UserIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
