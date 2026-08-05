/**
 * components/pages/AdminPage.tsx — Administrator dashboard
 *
 * Monitors: system health, request volumes, user accounts, API usage/costs,
 * conversations, and audit logs. Backed by /api/admin/* (admin-guarded).
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import {
  ShieldCheck,
  Activity,
  Users,
  DollarSign,
  Database,
  ScrollText,
  Ban,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

interface Summary {
  persisted: boolean;
  uptimeSec: number;
  users: { total: number; admins: number; banned: number };
  usage: { total: number; costUsd: number; avgLatencyMs: number; byEndpoint: { endpoint: string; count: number }[] };
  requests: { total: number; errors: number; errorRate: number; endpoints?: { endpoint: string; requests: number }[] };
  health: { engine: string; model: string; groq: string; supabase: string };
  memory: { rssMb: number; heapUsedMb: number };
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  banned: boolean;
  createdAt: string;
}

interface AuditLog {
  id: string;
  actorType: string;
  action: string;
  resource: string;
  ip: string;
  createdAt: string;
}

export function AdminPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [conversationCount, setConversationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'logs'>('overview');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, u, l, c] = await Promise.all([
        api.adminSummary(),
        api.adminUsers(),
        api.adminLogs(),
        api.adminConversations(),
      ]);
      setSummary(s);
      setUsers(u.users || []);
      setLogs(l.audit || []);
      setConversationCount((c.conversations || []).length);
    } catch (e: any) {
      setError(e.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleBan = async (user: AdminUser) => {
    try {
      await api.adminBanUser(user.id, !user.banned);
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to update user');
    }
  };

  const fmtUptime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-txt-primary mb-1 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-accent-primary" />
          Admin Console
        </h1>
        <p className="text-txt-secondary flex items-center gap-2">
          System monitoring, user moderation, and platform governance.
          {summary && !summary.persisted && (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-status-warning/10 text-status-warning">
              <AlertTriangle className="w-3 h-3" /> demo mode (no persistence)
            </span>
          )}
        </p>
      </motion.div>

      {error && (
        <div className="glass-card p-4 border-status-error/30 bg-status-error/5 text-status-error text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {(['overview', 'users', 'logs'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${
              activeTab === tab
                ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/30'
                : 'text-txt-secondary border border-sage-border hover:bg-sage-hover'
            }`}
          >
            {tab}
          </button>
        ))}
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto p-2 rounded-xl text-txt-secondary hover:bg-sage-hover transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !summary ? (
        <div className="flex justify-center py-24 text-txt-muted">Loading admin data…</div>
      ) : (
        <>
          {activeTab === 'overview' && summary && (
            <div className="space-y-6">
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<Activity className="w-5 h-5" />} label="Requests" value={String(summary.requests.total)} sub={`${summary.requests.errorRate}% errors`} accent="#58a6ff" />
                <StatCard icon={<Users className="w-5 h-5" />} label="Users" value={String(summary.users.total)} sub={`${summary.users.admins} admin · ${summary.users.banned} banned`} accent="#a78bfa" />
                <StatCard icon={<DollarSign className="w-5 h-5" />} label="Cost (7d)" value={`$${Number(summary.usage.costUsd).toFixed(4)}`} sub="LLM spend" accent="#3fb950" />
                <StatCard icon={<Database className="w-5 h-5" />} label="Uptime" value={fmtUptime(summary.uptimeSec)} sub={`RSS ${summary.memory.rssMb}MB`} accent="#f093fb" />
              </div>

              {/* Health */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
                <h2 className="font-display text-lg font-bold text-txt-primary mb-4">System Health</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <HealthRow label="Engine" value={summary.health.engine} ok />
                  <HealthRow label="Model" value={summary.health.model} ok />
                  <HealthRow label="Groq" value={summary.health.groq} ok={summary.health.groq === 'ok'} />
                  <HealthRow label="Supabase" value={summary.health.supabase} ok={summary.health.supabase === 'ok'} />
                  <HealthRow label="Avg Latency" value={`${summary.usage.avgLatencyMs}ms`} ok />
                  <HealthRow label="Conversations" value={String(conversationCount)} ok />
                </div>
              </motion.div>

              {/* Endpoint breakdown */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
                <h2 className="font-display text-lg font-bold text-txt-primary mb-4">Requests by Endpoint</h2>
                {summary.usage.byEndpoint.length === 0 && summary.requests.endpoints?.length === 0 ? (
                  <p className="text-sm text-txt-muted">No traffic recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {(summary.requests.endpoints?.length
                      ? summary.requests.endpoints.map((e) => ({ endpoint: e.endpoint, count: e.requests }))
                      : summary.usage.byEndpoint
                    ).slice(0, 10).map((e) => {
                      const max = Math.max(
                        1,
                        ...(summary.requests.endpoints?.length
                          ? summary.requests.endpoints.map((x) => x.requests)
                          : summary.usage.byEndpoint.map((x) => x.count))
                      );
                      return (
                        <div key={e.endpoint} className="flex items-center gap-3">
                          <span className="font-mono text-xs text-txt-secondary w-40 truncate">{e.endpoint}</span>
                          <div className="flex-1 h-2 rounded-full bg-sage-input overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-primary transition-all duration-500"
                              style={{ width: `${Math.max(2, (e.count / max) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-txt-primary w-10 text-right">{e.count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {activeTab === 'users' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 overflow-hidden">
              <h2 className="font-display text-lg font-bold text-txt-primary mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-accent-primary" /> User Accounts
              </h2>
              {users.length === 0 ? (
                <p className="text-sm text-txt-muted">No users found (persistence not configured).</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-txt-muted border-b border-sage-border">
                        <th className="py-2 pr-4">User</th>
                        <th className="py-2 pr-4">Role</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Joined</th>
                        <th className="py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-sage-border/40 hover:bg-sage-hover/50 transition-colors">
                          <td className="py-2.5 pr-4">
                            <div className="font-medium text-txt-primary">{u.name || '—'}</div>
                            <div className="text-xs font-mono text-txt-muted">{u.email}</div>
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.isAdmin ? 'bg-accent-primary/10 text-accent-primary' : 'bg-sage-input text-txt-secondary'}`}>
                              {u.isAdmin ? 'Admin' : 'User'}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className={`text-xs font-semibold ${u.banned ? 'text-status-error' : 'text-status-success'}`}>
                              {u.banned ? 'Banned' : 'Active'}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-txt-muted font-mono">
                            {u.createdAt ? u.createdAt.slice(0, 10) : '—'}
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => toggleBan(u)}
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                                u.banned
                                  ? 'border-status-success/30 text-status-success hover:bg-status-success/10'
                                  : 'border-status-error/30 text-status-error hover:bg-status-error/10'
                              }`}
                            >
                              {u.banned ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                              {u.banned ? 'Restore' : 'Suspend'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'logs' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
              <h2 className="font-display text-lg font-bold text-txt-primary mb-4 flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-accent-primary" /> Audit Log
              </h2>
              {logs.length === 0 ? (
                <p className="text-sm text-txt-muted">No audit events recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-[480px] overflow-y-auto">
                  {logs.map((l) => (
                    <div key={l.id} className="flex items-start gap-3 p-3 rounded-xl bg-sage-card/50 border border-sage-border/50">
                      <span className="mt-1 w-2 h-2 rounded-full bg-accent-secondary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-accent-primary">{l.action}</span>
                          <span className="text-[10px] text-txt-muted font-mono">{l.actorType}</span>
                          {l.resource && <span className="text-[10px] text-txt-muted font-mono truncate">→ {l.resource}</span>}
                        </div>
                        <div className="text-[10px] text-txt-muted font-mono mt-1">
                          {l.createdAt ? l.createdAt.replace('T', ' ').slice(0, 19) : ''} {l.ip ? `· ${l.ip}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5"
      style={{ borderColor: `${accent}25` }}
    >
      <div className="flex items-center gap-2 mb-3" style={{ color: accent }}>
        {icon}
        <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-txt-muted">{label}</span>
      </div>
      <div className="text-2xl font-display font-bold text-txt-primary">{value}</div>
      <div className="text-xs text-txt-muted mt-1">{sub}</div>
    </motion.div>
  );
}

function HealthRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-sage-card/50 border border-sage-border/50">
      <span className="text-sm text-txt-secondary">{label}</span>
      <span className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${ok ? 'bg-status-success' : 'bg-status-error'}`} />
        <span className="font-mono text-xs text-txt-primary">{value}</span>
      </span>
    </div>
  );
}
