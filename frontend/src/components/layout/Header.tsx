/**
 * components/layout/Header.tsx — Sticky premium header
 */
'use client';

import { useAppStore } from '@/stores/appStore';
import { Brain, Menu, PanelRight, Zap } from 'lucide-react';

export function Header() {
  const { user, toggleSidebar, toggleInspector, setPage } = useAppStore();

  return (
    <header className="relative z-50 h-14 flex items-center justify-between px-4 md:px-5 bg-sage-surface/85 backdrop-blur-2xl border-b border-sage-border">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-lg text-txt-secondary hover:text-txt-primary hover:bg-sage-hover transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-primary flex items-center justify-center shadow-glow-md">
            <Brain className="w-4.5 h-4.5 text-white" strokeWidth={1.8} />
          </div>
          <div className="hidden sm:block">
            <div className="font-display text-[19px] font-bold tracking-tight bg-gradient-text bg-clip-text text-transparent">
              SAGE
            </div>
            <div className="text-[9px] text-txt-muted tracking-[0.08em] uppercase -mt-1">
              Systemic Agentic General Engine
            </div>
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Status pill - hidden on small mobile */}
        <div className="hidden sm:flex items-center gap-2 px-3 h-7 rounded-full bg-sage-panel border border-sage-border text-[11px] text-txt-secondary">
          <span className="w-[7px] h-[7px] bg-status-success rounded-full shadow-[0_0_8px_#3fb950] animate-pulse-slow" />
          <span className="hidden md:inline">Engine Online · llama-3.3-70b</span>
          <span className="md:hidden">Online</span>
        </div>

        {/* Inspector toggle */}
        <button
          onClick={toggleInspector}
          className="p-2 rounded-lg text-txt-secondary hover:text-txt-primary hover:bg-sage-hover transition-colors"
          aria-label="Toggle inspector"
          title="Toggle inspector panel"
        >
          <PanelRight className="w-5 h-5" />
        </button>

        {/* Subscription entry point (Phase 8) — next to the profile avatar */}
        <button
          onClick={() => setPage('billing')}
          className="hidden sm:flex items-center gap-1.5 px-3 h-8 rounded-lg bg-gradient-button text-white text-xs font-semibold shadow-glow-md hover:shadow-glow-lg hover:-translate-y-0.5 transition-all duration-200 active:translate-y-0"
          title="View plans & usage"
        >
          <Zap className="w-3.5 h-3.5" />
          Upgrade
        </button>

        {/* User avatar */}
        <div
          onClick={() => setPage('settings')}
          className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold text-xs cursor-pointer hover:shadow-glow-md transition-shadow"
          title="Settings"
        >
          {user?.name?.charAt(0).toUpperCase() || 'S'}
        </div>
      </div>
    </header>
  );
}
