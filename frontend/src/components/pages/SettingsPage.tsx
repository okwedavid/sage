/**
 * components/pages/SettingsPage.tsx — Settings & configuration
 */
'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { motion } from 'framer-motion';
import { Moon, Shield, Info } from 'lucide-react';
import { ApiKeysSection } from '@/components/settings/ApiKeysSection';
import { ProviderSection } from '@/components/settings/ProviderSection';

export function SettingsPage() {
  const { user } = useAppStore();

  // Security (audit P1-6): the legacy "personal API key" flow stored a raw key
  // in localStorage. Provider credentials are now stored server-side, AES-256-GCM
  // encrypted (Settings → Models & API Providers). Scrub any previously saved key.
  useEffect(() => {
    localStorage.removeItem('sage_custom_api_key');
    localStorage.removeItem('sage_custom_model');
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-txt-primary mb-2">Settings</h1>
        <p className="text-txt-secondary">Configure your SAGE experience and personalize AI responses.</p>
      </motion.div>

      {/* Profile */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <h2 className="font-display text-lg font-bold text-txt-primary mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent-primary" />
          Profile
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-txt-secondary">Name</span>
            <span className="text-sm font-medium text-txt-primary">{user?.name || '-'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-t border-sage-border">
            <span className="text-sm text-txt-secondary">Email</span>
            <span className="text-sm font-mono text-txt-primary">{user?.email || '-'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-t border-sage-border">
            <span className="text-sm text-txt-secondary">User ID</span>
            <span className="text-xs font-mono text-txt-muted">{user?.id?.slice(0, 16) || '-'}...</span>
          </div>
        </div>
      </motion.div>

      {/* Models & API Providers (Phase 2/3) */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <ProviderSection />
      </motion.div>

      {/* API Keys (Phase 7) */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <ApiKeysSection />
      </motion.div>

      {/* Preferences */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-6"
      >
        <h2 className="font-display text-lg font-bold text-txt-primary mb-4 flex items-center gap-2">
          <Moon className="w-5 h-5 text-accent-primary" />
          Preferences
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-txt-primary">Dark Mode</div>
              <div className="text-xs text-txt-muted">Always enabled — designed for focus</div>
            </div>
            <div className="flex items-center gap-2 text-status-success text-xs font-semibold">
              <Moon className="w-4 h-4" />
              Always On
            </div>
          </div>
        </div>
      </motion.div>

      {/* System info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-6"
      >
        <h2 className="font-display text-lg font-bold text-txt-primary mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-accent-primary" />
          System
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-xl bg-sage-card/50 border border-sage-border/50">
            <div className="text-[10px] font-bold tracking-wider text-txt-muted uppercase mb-1">Version</div>
            <div className="font-mono text-txt-primary">SAGE v1.0.0</div>
          </div>
          <div className="p-3 rounded-xl bg-sage-card/50 border border-sage-border/50">
            <div className="text-[10px] font-bold tracking-wider text-txt-muted uppercase mb-1">Model</div>
            <div className="font-mono text-txt-primary text-xs">llama-3.3-70b-versatile</div>
          </div>
          <div className="p-3 rounded-xl bg-sage-card/50 border border-sage-border/50">
            <div className="text-[10px] font-bold tracking-wider text-txt-muted uppercase mb-1">Frontend</div>
            <div className="font-mono text-txt-primary">Next.js 14</div>
          </div>
          <div className="p-3 rounded-xl bg-sage-card/50 border border-sage-border/50">
            <div className="text-[10px] font-bold tracking-wider text-txt-muted uppercase mb-1">Backend</div>
            <div className="font-mono text-txt-primary">Express + TypeScript</div>
          </div>
          <div className="p-3 rounded-xl bg-sage-card/50 border border-sage-border/50">
            <div className="text-[10px] font-bold tracking-wider text-txt-muted uppercase mb-1">Database</div>
            <div className="font-mono text-txt-primary">Supabase</div>
          </div>
          <div className="p-3 rounded-xl bg-sage-card/50 border border-sage-border/50">
            <div className="text-[10px] font-bold tracking-wider text-txt-muted uppercase mb-1">AI Provider</div>
            <div className="font-mono text-txt-primary">Groq LPU</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
