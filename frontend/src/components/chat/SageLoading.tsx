/**
 * components/chat/SageLoading.tsx — Sage-identity loading indicator (Phase 9)
 *
 * Appears exactly where the response body will render: a pulsing SAGE brain
 * badge with a shimmering status line. Uses only the existing design tokens
 * (gradient-primary, shadow-glow-*, pulse/glow animations) — no new branding.
 */
'use client';

import { Brain, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export function SageLoading({ label }: { label?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      role="status"
      aria-live="polite"
      aria-label="SAGE is thinking"
      className="flex gap-2.5 md:gap-3 items-start"
    >
      {/* Sage badge */}
      <motion.div
        animate={{ scale: [1, 1.06, 1], rotate: [0, -3, 3, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="w-7 h-7 md:w-8 md:h-8 shrink-0 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow-md"
      >
        <Brain className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
      </motion.div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 text-[10px] md:text-[11px] text-txt-muted">
          <span className="font-semibold text-txt-secondary">SAGE</span>
          <span>·</span>
          <span className="flex items-center gap-1 text-txt-accent">
            <Sparkles className="w-2.5 h-2.5" />
            {label || 'Thinking…'}
          </span>
        </div>

        {/* Skeleton response body in the exact response area */}
        <div className="response-card">
          <div className="flex items-center justify-between px-3 md:px-4 py-2 md:py-2.5 bg-sage-card/60 border-b border-sage-border text-[10px] md:text-[11px] font-semibold text-txt-secondary">
            <span className="flex items-center gap-1.5 md:gap-2">
              <span className="text-status-info">📄</span>
              <span>Working on it</span>
            </span>
            <span className="text-txt-muted shrink-0 ml-2">…</span>
          </div>
          <div className="px-3 md:px-5 py-4 md:py-5 space-y-2.5">
            <div className="h-3 rounded-full bg-sage-hover animate-pulse w-11/12" />
            <div className="h-3 rounded-full bg-sage-hover animate-pulse w-8/12" />
            <div className="h-3 rounded-full bg-sage-hover animate-pulse w-10/12" />
            <div className="h-3 rounded-full bg-sage-hover animate-pulse w-6/12" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
