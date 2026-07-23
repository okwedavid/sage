/**
 * components/layout/Header.tsx — Sticky premium header
 */
'use client';

import { useAppStore } from '@/stores/appStore';
import { Brain, Zap, User } from 'lucide-react';

export function Header() {
  const { user } = useAppStore();

  return (
    <header className="relative z-50 h-14 flex items-center justify-between px-5 bg-sage-surface/85 backdrop-blur-2xl border-b border-sage-border">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-[10px] bg-gradient-primary flex items-center justify-center shadow-glow-md">
          <Brain className="w-4.5 h-4.5 text-white" strokeWidth={1.8} />
        </div>
        <div>
          <div className="font-display text-[19px] font-bold tracking-tight bg-gradient-text bg-clip-text text-transparent">
            SAGE
          </div>
          <div className="text-[9px] text-txt-muted tracking-[0.08em] uppercase -mt-1">
            Systemic Agentic General Engine
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Status pill */}
        <div className="flex items-center gap-2 px-3 h-7 rounded-full bg-sage-panel border border-sage-border text-[11px] text-txt-secondary">
          <span className="w-[7px] h-[7px] bg-status-success rounded-full shadow-[0_0_8px_#3fb950] animate-pulse-slow" />
          Engine Online · llama-3.3-70b
        </div>

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold text-xs cursor-pointer hover:shadow-glow-md transition-shadow">
          {user?.name?.charAt(0).toUpperCase() || 'S'}
        </div>
      </div>
    </header>
  );
}
