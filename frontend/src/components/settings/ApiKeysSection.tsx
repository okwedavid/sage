/**
 * components/settings/ApiKeysSection.tsx — Sage-issued API key management
 * (Phase 7). Distinct from provider credentials: these are keys Sage issues
 * TO users for the REST API, not third-party AI keys supplied BY users.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Plus, Copy, Check, RotateCw, Trash2, BookOpen, Code2 } from 'lucide-react';
import { api } from '@/lib/api';

interface ApiKeyItem {
  id: string;
  name: string;
  suffix: string;
  scopes: string[];
  quotaPerDay: number;
  requestsToday: number;
  status: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [onceKey, setOnceKey] = useState<{ plaintext: string; note: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.listApiKeys();
      setKeys(res.keys || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load API keys');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    setBusy(true);
    setError('');
    setOnceKey(null);
    try {
      const res = await api.createApiKey(name.trim() || 'Default Key');
      // Plaintext is returned exactly once — show it with a copy button.
      setOnceKey({ plaintext: res.key, note: res.note });
      setName('');
      await load();
    } catch (e: any) {
      const body = e?.body;
      setError(body?.error || e.message || 'Failed to create API key');
    } finally {
      setBusy(false);
    }
  };

  const handleRotate = async (id: string) => {
    setBusy(true);
    setError('');
    setOnceKey(null);
    try {
      const res = await api.rotateApiKey(id);
      setOnceKey({ plaintext: res.key, note: res.note });
      await load();
    } catch (e: any) {
      setError(e?.body?.error || e.message || 'Failed to rotate key');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm('Revoke this API key? Requests using it will immediately fail.')) return;
    setError('');
    try {
      await api.revokeApiKey(id);
      await load();
    } catch (e: any) {
      setError(e?.body?.error || e.message || 'Failed to revoke key');
    }
  };

  const copyOnce = () => {
    if (!onceKey) return;
    navigator.clipboard.writeText(onceKey.plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card p-6">
      <h2 className="font-display text-lg font-bold text-txt-primary mb-1 flex items-center gap-2">
        <Key className="w-5 h-5 text-accent-primary" />
        API Keys
      </h2>
      <p className="text-sm text-txt-secondary mb-4">
        Keys issued by SAGE for programmatic API access. The full key is shown only once at creation.
      </p>

      {/* Create */}
      <div className="flex gap-2 mb-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g. production-bot)"
          maxLength={80}
          className="flex-1 h-10 px-3.5 rounded-xl bg-sage-input border border-sage-border text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent-primary transition-all"
        />
        <button
          onClick={handleCreate}
          disabled={busy}
          className="h-10 px-4 rounded-xl bg-gradient-button text-white text-sm font-semibold flex items-center gap-1.5 hover:shadow-glow-md hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:translate-y-0 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create Key
        </button>
      </div>

      {/* One-time plaintext */}
      <AnimatePresence>
        {onceKey && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <div className="p-3.5 rounded-xl bg-accent-primary/10 border border-accent-primary/30">
              <p className="text-xs text-txt-secondary mb-2">{onceKey.note}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 font-mono text-[11px] text-accent-primary bg-sage-card/70 border border-sage-border rounded-lg px-3 py-2 overflow-x-auto whitespace-nowrap">
                  {onceKey.plaintext}
                </code>
                <button
                  onClick={copyOnce}
                  className="p-2 rounded-lg bg-sage-panel border border-sage-border text-txt-secondary hover:text-txt-primary hover:border-accent-primary/40 transition-all shrink-0"
                  title="Copy key"
                >
                  {copied ? <Check className="w-4 h-4 text-status-success" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="text-xs text-status-error mb-3">{error}</p>
      )}

      {/* Key list */}
      {keys.length === 0 ? (
        <p className="text-xs text-txt-muted py-3">No API keys yet. Create one above to get started.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-sage-card/50 border border-sage-border/70 hover:border-sage-border-md transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-txt-primary truncate">{k.name}</span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                      k.status === 'active' ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error'
                    }`}
                  >
                    {k.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-txt-muted font-mono">
                  <span>…{k.suffix}</span>
                  <span>created {new Date(k.createdAt).toLocaleDateString()}</span>
                  <span>
                    {k.requestsToday}/{k.quotaPerDay} today
                  </span>
                  {k.lastUsedAt && <span>last used {new Date(k.lastUsedAt).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleRotate(k.id)}
                  disabled={busy || k.status !== 'active'}
                  className="p-2 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-sage-hover transition-all disabled:opacity-30"
                  title="Rotate key"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleRevoke(k.id)}
                  disabled={busy}
                  className="p-2 rounded-lg text-txt-muted hover:text-status-error hover:bg-sage-hover transition-all disabled:opacity-30"
                  title="Revoke key"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* API documentation */}
      <div className="mt-5 pt-4 border-t border-sage-border">
        <h3 className="text-xs font-bold tracking-[0.1em] uppercase text-txt-muted mb-2 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" /> API Documentation
        </h3>
        <p className="text-xs text-txt-secondary leading-relaxed mb-2">
          Authenticate with your key as a bearer token. Keys are scoped to chat and conversation endpoints.
        </p>
        <div className="rounded-xl bg-sage-card/70 border border-sage-border overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-sage-border text-[11px] text-txt-muted">
            <Code2 className="w-3 h-3" /> Example request
          </div>
          <pre className="px-3 py-3 text-[11px] font-mono text-txt-secondary overflow-x-auto leading-relaxed">
{`curl -X POST https://your-backend/api/chat \\
  -H "Authorization: Bearer sk_sage_..." \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello SAGE"}'`}
          </pre>
        </div>
        <p className="text-[11px] text-txt-muted mt-2">
          Create keys in Settings → API Keys. Revoke immediately if a key is leaked — rotation mints a fresh key and revokes the old one.
        </p>
      </div>
    </div>
  );
}
