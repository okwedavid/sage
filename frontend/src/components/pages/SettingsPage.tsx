/**
 * components/pages/SettingsPage.tsx — Settings & configuration
 */
'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { motion } from 'framer-motion';
import { Key, Volume2, Moon, Shield, Info, Save, Eye, EyeOff, Cpu } from 'lucide-react';

export function SettingsPage() {
  const { user, ttsEnabled, toggleTts, apiKey, setApiKey } = useAppStore();
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('llama-3.3-70b-versatile');
  const [saved, setSaved] = useState(false);

  // Load saved settings
  useEffect(() => {
    const savedKey = localStorage.getItem('sage_custom_api_key');
    const savedModel = localStorage.getItem('sage_custom_model');
    if (savedKey) setApiKey(savedKey);
    if (savedModel) setSelectedModel(savedModel);
  }, []);

  const handleSave = () => {
    localStorage.setItem('sage_custom_api_key', apiKey);
    localStorage.setItem('sage_custom_model', selectedModel);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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

      {/* LLM Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <h2 className="font-display text-lg font-bold text-txt-primary mb-4 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-accent-primary" />
          LLM Configuration
        </h2>
        <p className="text-sm text-txt-secondary mb-4">
          Customize the AI model and API key to tailor responses to your preferences.
        </p>
        
        <div className="space-y-4">
          {/* API Key */}
          <div>
            <label className="text-sm font-medium text-txt-primary mb-1.5 block">
              Personal Groq API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="gsk_your_api_key_here"
                className="w-full h-11 px-4 pr-11 rounded-xl bg-sage-input border border-sage-border text-txt-primary text-sm font-mono placeholder:text-txt-muted focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-txt-muted mt-1.5">
              Get your free API key at{' '}
              <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">
                console.groq.com
              </a>
              . Leave empty to use the server default.
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="text-sm font-medium text-txt-primary mb-1.5 block">
              AI Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full h-11 px-4 rounded-xl bg-sage-input border border-sage-border text-txt-primary text-sm focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all cursor-pointer"
            >
              <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Recommended - Best Balance)</option>
              <option value="llama-3.1-70b-versatile">Llama 3.1 70B (Stable)</option>
              <option value="llama-3.1-8b-instant">Llama 3.1 8B (Fastest)</option>
              <option value="mixtral-8x7b-32768">Mixtral 8x7B (32K Context)</option>
              <option value="gemma2-9b-it">Gemma 2 9B (Google)</option>
            </select>
            <p className="text-xs text-txt-muted mt-1.5">
              Different models have different strengths. 70B models are most capable, 8B is fastest.
            </p>
          </div>

          {/* Model Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <div className="p-3 rounded-xl bg-sage-card/50 border border-sage-border/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-status-success" />
                <span className="text-xs font-semibold text-txt-primary">70B Models</span>
              </div>
              <p className="text-[11px] text-txt-secondary leading-relaxed">
                Best for complex reasoning, coding, analysis. Slower but most accurate.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-sage-card/50 border border-sage-border/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-status-info" />
                <span className="text-xs font-semibold text-txt-primary">8B Models</span>
              </div>
              <p className="text-[11px] text-txt-secondary leading-relaxed">
                Lightning fast responses. Great for simple queries and quick answers.
              </p>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="w-full btn-primary py-3 flex items-center justify-center gap-2"
          >
            {saved ? (
              <>
                <span className="text-status-success">✓</span>
                Settings Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Configuration
              </>
            )}
          </button>
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
            <div className="font-mono text-txt-primary">SAGE v7.1</div>
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
