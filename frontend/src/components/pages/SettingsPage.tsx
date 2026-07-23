/**
 * components/pages/SettingsPage.tsx — Settings & configuration
 */
'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { motion } from 'framer-motion';
import { Key, Volume2, Moon, Shield, Info } from 'lucide-react';

export function SettingsPage() {
  const { user, ttsEnabled, toggleTts, apiKey, setApiKey } = useAppStore();
  const [saved, setSaved] = useState(false);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-txt-primary mb-2">Settings</h1>
        <p className="text-txt-secondary">Configure your SAGE experience.</p>
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

      {/* API Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <h2 className="font-display text-lg font-bold text-txt-primary mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-accent-primary" />
          API Configuration
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-txt-secondary mb-1.5 block">Groq API Key (override)</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full h-11 px-4 rounded-xl bg-sage-input border border-sage-border text-txt-primary text-sm font-mono placeholder:text-txt-muted focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all"
            />
            <p className="text-xs text-txt-muted mt-1.5">
              Leave empty to use server-side key. Your key is stored in browser memory only.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Preferences */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-6"
      >
        <h2 className="font-display text-lg font-bold text-txt-primary mb-4 flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-accent-primary" />
          Preferences
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-txt-primary">Voice Responses</div>
              <div className="text-xs text-txt-muted">Enable text-to-speech for AI responses</div>
            </div>
            <button
              onClick={toggleTts}
              className={`w-12 h-7 rounded-full transition-all duration-200 ${
                ttsEnabled ? 'bg-accent-primary' : 'bg-sage-input border border-sage-border'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  ttsEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-sage-border">
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
            <div className="font-mono text-txt-primary">SAGE v7.0</div>
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
