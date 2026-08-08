/**
 * components/settings/ProviderSection.tsx — Bring-your-own AI provider
 * (Phase 2/3). Users connect their own OpenAI / Anthropic / Gemini / Groq /
 * OpenRouter / OpenAI-compatible credentials. Keys are encrypted at rest and
 * never displayed again after connection.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Plus, Loader2, Trash2, Check, Activity, Star, Plug, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';

interface CatalogEntry {
  id: string;
  label: string;
  description: string;
  requiresBaseUrl: boolean;
  configurableVision: boolean;
  defaultModel: string;
  docsUrl: string;
}

interface ProviderCredential {
  id: string;
  provider: string;
  label: string;
  model: string | null;
  baseUrl: string | null;
  status: 'active' | 'error';
  lastError: string | null;
  lastCheckedAt: string | null;
  capabilities: Record<string, any>;
  createdAt: string;
}

export function ProviderSection() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [creds, setCreds] = useState<ProviderCredential[]>([]);
  const [providerId, setProviderId] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [supportsVision, setSupportsVision] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [models, setModels] = useState<{ id: string; vision?: boolean }[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cat, list] = await Promise.all([api.getProviderCatalog(), api.listProviders()]);
      setCatalog(cat.providers || []);
      setCreds(list.credentials || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load providers');
    }
  }, []);

  useEffect(() => {
    load();
    // Restore the active provider selection for chat.
    const active = localStorage.getItem('sage_active_provider_id');
    if (active) setActiveId(active);
  }, [load]);

  const entry = catalog.find((c) => c.id === providerId);

  const handleConnect = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.connectProvider({
        provider: providerId,
        apiKey: apiKey.trim(),
        label: label.trim() || undefined,
        baseUrl: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
        supportsVision,
      });
      if (res?.credential) {
        setCreds((prev) => [res.credential, ...prev]);
        if (res.models?.length) {
          setModels(res.models);
          setLoadedFor(res.credential.id);
        }
        setApiKey('');
        setBaseUrl('');
        setLabel('');
        setModel('');
      } else {
        setError(res?.error || 'Failed to connect provider');
      }
    } catch (e: any) {
      const body = e?.body;
      setError(body?.error || e.message || 'Failed to connect provider');
    } finally {
      setBusy(false);
    }
  };

  const loadModels = async (id: string) => {
    setError('');
    try {
      const res = await api.getProviderModels(id);
      setModels(res.models || []);
      setLoadedFor(id);
    } catch (e: any) {
      setError(e?.body?.error || e.message || 'Failed to load models');
    }
  };

  const selectModel = async (id: string, modelId: string) => {
    setError('');
    try {
      await api.updateProvider(id, { model: modelId });
      setCreds((prev) => prev.map((c) => (c.id === id ? { ...c, model: modelId } : c)));
    } catch (e: any) {
      setError(e?.body?.error || 'Failed to select model');
    }
  };

  const setActive = (id: string | null) => {
    setActiveId(id);
    if (id) localStorage.setItem('sage_active_provider_id', id);
    else localStorage.removeItem('sage_active_provider_id');
  };

  const health = async (id: string) => {
    setError('');
    try {
      const res = await api.healthCheckProvider(id);
      if (!res.ok) setError(res.error || 'Health check failed');
    } catch (e: any) {
      setError(e?.body?.error || 'Health check failed');
    }
    await load();
  };

  const revoke = async (id: string) => {
    if (!window.confirm('Disconnect this provider? Its encrypted key will be deleted.')) return;
    setError('');
    try {
      await api.revokeProvider(id);
      if (activeId === id) setActive(null);
      setCreds((prev) => prev.filter((c) => c.id !== id));
      if (loadedFor === id) {
        setModels([]);
        setLoadedFor(null);
      }
    } catch (e: any) {
      setError(e?.body?.error || 'Failed to revoke provider');
    }
  };

  return (
    <div className="glass-card p-6">
      <h2 className="font-display text-lg font-bold text-txt-primary mb-1 flex items-center gap-2">
        <Cpu className="w-5 h-5 text-accent-primary" />
        Models &amp; API Providers
      </h2>
      <p className="text-sm text-txt-secondary mb-4">
        Connect your own AI provider credentials. Keys are encrypted at rest and are never shown again after
        connection.
      </p>

      {/* Connect form */}
      <div className="space-y-3 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-txt-secondary mb-1.5 block">Provider</label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-sage-input border border-sage-border text-sm text-txt-primary focus:outline-none focus:border-accent-primary transition-all cursor-pointer"
            >
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            {entry && (
              <p className="text-[11px] text-txt-muted mt-1">
                {entry.description}.{' '}
                <a href={entry.docsUrl} target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">
                  Get a key
                </a>
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-txt-secondary mb-1.5 block">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-…"
              className="w-full h-10 px-3 rounded-xl bg-sage-input border border-sage-border text-sm font-mono text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent-primary transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-txt-secondary mb-1.5 block">Label (optional)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My work key"
              maxLength={80}
              className="w-full h-10 px-3 rounded-xl bg-sage-input border border-sage-border text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent-primary transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-txt-secondary mb-1.5 block">Model (optional)</label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={entry?.defaultModel || 'Auto-discover'}
              className="w-full h-10 px-3 rounded-xl bg-sage-input border border-sage-border text-sm font-mono text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent-primary transition-all"
            />
          </div>
        </div>

        {entry?.requiresBaseUrl && (
          <div>
            <label className="text-xs font-medium text-txt-secondary mb-1.5 block">
              Base URL <span className="text-status-error">*</span>
            </label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:11434/v1"
              className="w-full h-10 px-3 rounded-xl bg-sage-input border border-sage-border text-sm font-mono text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent-primary transition-all"
            />
          </div>
        )}

        {entry?.configurableVision && (
          <label className="flex items-center gap-2 text-sm text-txt-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={supportsVision}
              onChange={(e) => setSupportsVision(e.target.checked)}
              className="accent-accent-primary w-4 h-4"
            />
            This endpoint supports image input (vision)
          </label>
        )}

        <button
          onClick={handleConnect}
          disabled={busy}
          className="h-10 px-4 rounded-xl bg-gradient-button text-white text-sm font-semibold flex items-center gap-1.5 hover:shadow-glow-md hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:translate-y-0"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
          Connect &amp; Validate
        </button>

        {error && <p className="text-xs text-status-error">{error}</p>}
      </div>

      {/* Connected providers */}
      {creds.length === 0 ? (
        <p className="text-xs text-txt-muted py-3">
          No providers connected. Chat currently uses the SAGE default model.
        </p>
      ) : (
        <div className="space-y-3">
          {creds.map((c) => {
            const cat = catalog.find((x) => x.id === c.provider);
            const isActive = activeId === c.id;
            return (
              <div key={c.id} className="rounded-xl bg-sage-card/50 border border-sage-border/70 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-txt-primary">{c.label || cat?.label || c.provider}</span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                          c.status === 'active' ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error'
                        }`}
                      >
                        {c.status}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent-primary/20 text-accent-primary">
                          Active for chat
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-txt-muted font-mono">
                      <span>{c.provider}</span>
                      {c.model && <span>model: {c.model}</span>}
                      {c.baseUrl && <span className="truncate max-w-[240px]">{c.baseUrl}</span>}
                      <span>key: encrypted at rest 🔒</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => (isActive ? setActive(null) : setActive(c.id))}
                      className={`p-2 rounded-lg transition-all ${
                        isActive
                          ? 'text-accent-primary bg-accent-primary/10'
                          : 'text-txt-muted hover:text-txt-primary hover:bg-sage-hover'
                      }`}
                      title={isActive ? 'Use default model for chat' : 'Route chat through this provider'}
                    >
                      <Star className="w-3.5 h-3.5" fill={isActive ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => health(c.id)}
                      className="p-2 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-sage-hover transition-all"
                      title="Check health"
                    >
                      <Activity className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => revoke(c.id)}
                      className="p-2 rounded-lg text-txt-muted hover:text-status-error hover:bg-sage-hover transition-all"
                      title="Disconnect"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Model selection */}
                <div className="mt-3">
                  {loadedFor === c.id ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={c.model || ''}
                        onChange={(e) => selectModel(c.id, e.target.value)}
                        className="h-9 px-2.5 rounded-lg bg-sage-input border border-sage-border text-xs text-txt-primary focus:outline-none focus:border-accent-primary transition-all"
                      >
                        {models.length === 0 && <option value="">No models found</option>}
                        {models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id}
                            {m.vision ? ' (vision)' : ''}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-txt-muted">{models.length} models</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => loadModels(c.id)}
                      className="text-[11px] text-accent-primary hover:underline flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Load available models
                    </button>
                  )}
                </div>

                {c.lastError && <p className="text-[11px] text-status-error mt-2">Last error: {c.lastError}</p>}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-txt-muted mt-4 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" />
        Provider keys are AES-256-GCM encrypted at rest and never leave the backend, appear in logs, or return to this page.
      </p>
    </div>
  );
}
