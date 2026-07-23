/**
 * components/pages/LandingPage.tsx — Stunning landing page for unauthenticated users
 */
'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
import { Brain, ArrowRight, Sparkles, Shield, Zap, Globe, Eye, Code } from 'lucide-react';
import { motion } from 'framer-motion';

export function LandingPage() {
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useAppStore();

  const handleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      const result = isRegister
        ? await api.register(email, password, name)
        : await api.login(email, password);

      localStorage.setItem('sage_token', result.token);
      localStorage.setItem('sage_user', JSON.stringify(result.user));
      setUser(result.user, result.token);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setLoading(true);
    try {
      const result = await api.demo();
      localStorage.setItem('sage_token', result.token);
      localStorage.setItem('sage_user', JSON.stringify(result.user));
      setUser(result.user, result.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-y-auto bg-sage-bg relative">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-5%] w-[700px] h-[700px] rounded-full bg-accent-primary/12 blur-[150px]" />
        <div className="absolute bottom-[-30%] right-[-10%] w-[600px] h-[600px] rounded-full bg-accent-tertiary/8 blur-[120px]" />
        <div className="absolute top-[30%] right-[20%] w-[400px] h-[400px] rounded-full bg-accent-secondary/6 blur-[100px]" />
      </div>

      {/* Hero section */}
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Top bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between py-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-gradient-primary flex items-center justify-center shadow-glow-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display text-2xl font-bold bg-gradient-text bg-clip-text text-transparent">
                SAGE
              </div>
              <div className="text-[10px] text-txt-muted tracking-[0.1em] uppercase -mt-1">
                Systemic Agentic General Engine
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLogin(true)}
              className="btn-ghost text-sm"
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setIsRegister(true);
                setShowLogin(true);
              }}
              className="btn-primary text-sm"
            >
              Get Started
            </button>
          </div>
        </motion.div>

        {/* Hero content */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-center pt-16 pb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            AI Cognitive Operating System
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-6">
            <span className="text-txt-primary">Think. </span>
            <span className="bg-gradient-text bg-clip-text text-transparent">Understand.</span>
            <br />
            <span className="text-txt-primary">Act. </span>
            <span className="bg-gradient-primary bg-clip-text text-transparent">Evolve.</span>
          </h1>

          <p className="text-txt-secondary text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Not a chatbot, not a wrapper. A systemic AI engine with a 5-stage cognitive pipeline
            that normalizes, classifies, validates, routes, and executes your intent through specialized AI workers.
          </p>

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleDemo}
              disabled={loading}
              className="btn-primary text-base px-8 py-4 flex items-center gap-2"
            >
              {loading ? 'Loading...' : 'Launch Demo'}
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowLogin(true)}
              className="btn-ghost text-base px-8 py-4"
            >
              Sign In
            </button>
          </div>
        </motion.div>

        {/* Pipeline visualization */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mb-16"
        >
          <div className="glass-card p-6 max-w-3xl mx-auto">
            <div className="text-[10px] font-bold tracking-[0.12em] text-txt-muted uppercase mb-4 text-center">
              5-Stage Cognitive Pipeline
            </div>
            <div className="flex items-center justify-between gap-2">
              {[
                { icon: '📝', label: 'Normalize', color: '#58a6ff' },
                { icon: '🧠', label: 'Classify', color: '#a78bfa' },
                { icon: '🔍', label: 'Validate', color: '#3fb950' },
                { icon: '🔀', label: 'Route', color: '#f0883e' },
                { icon: '⚡', label: 'Execute', color: '#f093fb' },
              ].map((stage, i) => (
                <div key={stage.label} className="flex items-center gap-2">
                  <div className="text-center">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-xl mb-2"
                      style={{ background: `${stage.color}15`, border: `1px solid ${stage.color}30` }}
                    >
                      {stage.icon}
                    </div>
                    <div className="text-[10px] font-mono text-txt-secondary">{stage.label}</div>
                  </div>
                  {i < 4 && (
                    <div className="w-8 h-[2px] bg-gradient-to-r from-sage-border-md to-transparent mb-5" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Features grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-16"
        >
          {[
            {
              icon: <Zap className="w-6 h-6" />,
              title: 'Lightning Fast',
              desc: 'Powered by Groq LPU inference — sub-second responses on 70B parameter models.',
              color: '#667eea',
            },
            {
              icon: <Eye className="w-6 h-6" />,
              title: 'Vision Intelligence',
              desc: 'Upload images for multimodal analysis — diagrams, photos, screenshots.',
              color: '#a78bfa',
            },
            {
              icon: <Globe className="w-6 h-6" />,
              title: 'Web Analysis',
              desc: 'Paste any URL and SAGE fetches, parses, and analyzes the content.',
              color: '#58a6ff',
            },
            {
              icon: <Code className="w-6 h-6" />,
              title: '10 Task Types',
              desc: 'Research, Analyze, Build, Debug, Explain, Generate, Summarize, Plan, Translate, Review.',
              color: '#3fb950',
            },
            {
              icon: <Shield className="w-6 h-6" />,
              title: 'Validated Output',
              desc: 'Every response passes through confidence scoring and quality gates.',
              color: '#f0883e',
            },
            {
              icon: <Brain className="w-6 h-6" />,
              title: 'Plugin Architecture',
              desc: 'Extensible worker registry — add new AI agents without touching core.',
              color: '#f093fb',
            },
          ].map((feature) => (
            <div key={feature.title} className="service-card group">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${feature.color}15`, color: feature.color }}
              >
                {feature.icon}
              </div>
              <h3 className="text-base font-semibold text-txt-primary mb-2 relative z-10">
                {feature.title}
              </h3>
              <p className="text-sm text-txt-secondary leading-relaxed relative z-10">
                {feature.desc}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Architecture section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center pb-16"
        >
          <div className="glass-card inline-block px-6 py-4">
            <code className="font-mono text-sm text-txt-secondary">
              <span className="text-status-info">User Input</span>
              <span className="text-txt-muted"> → </span>
              <span className="text-accent-primary">Normalize</span>
              <span className="text-txt-muted"> → </span>
              <span className="text-accent-glow">Classify</span>
              <span className="text-txt-muted"> → </span>
              <span className="text-status-success">Validate</span>
              <span className="text-txt-muted"> → </span>
              <span className="text-status-warning">Route</span>
              <span className="text-txt-muted"> → </span>
              <span className="text-accent-tertiary">Execute</span>
              <span className="text-txt-muted"> → </span>
              <span className="text-status-success">Respond</span>
            </code>
          </div>
        </motion.div>
      </div>

      {/* Login/Register Modal */}
      {showLogin && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowLogin(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-card p-8 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-[12px] bg-gradient-primary flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-txt-primary">
                  {isRegister ? 'Create Account' : 'Welcome Back'}
                </h2>
                <p className="text-xs text-txt-muted">
                  {isRegister ? 'Join SAGE' : 'Sign in to continue'}
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-status-error/10 border border-status-error/20 rounded-xl px-4 py-2.5 mb-4 text-status-error text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3">
              {isRegister && (
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-sage-input border border-sage-border text-txt-primary text-sm placeholder:text-txt-muted focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all"
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-sage-input border border-sage-border text-txt-primary text-sm placeholder:text-txt-muted focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                className="w-full h-11 px-4 rounded-xl bg-sage-input border border-sage-border text-txt-primary text-sm placeholder:text-txt-muted focus:outline-none focus:border-accent-primary focus:shadow-glow-sm transition-all"
              />
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={handleAuth}
                disabled={loading}
                className="w-full btn-primary py-3 text-sm"
              >
                {loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
              </button>

              <button
                onClick={handleDemo}
                disabled={loading}
                className="w-full btn-ghost py-3 text-sm"
              >
                Try Demo (No Account)
              </button>
            </div>

            <div className="mt-4 text-center text-sm text-txt-muted">
              {isRegister ? 'Already have an account? ' : "Don't have an account? "}
              <button
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError('');
                }}
                className="text-accent-primary hover:underline"
              >
                {isRegister ? 'Sign In' : 'Register'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
