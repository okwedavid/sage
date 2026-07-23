/**
 * components/chat/PipelineViz.tsx — Live pipeline execution visualization
 */
'use client';

import { motion } from 'framer-motion';

const STAGES = [
  { icon: '📝', label: 'Normalize', key: 'normalize' },
  { icon: '🧠', label: 'Classify', key: 'classify' },
  { icon: '🔍', label: 'Validate', key: 'validate' },
  { icon: '🔀', label: 'Route', key: 'route' },
  { icon: '⚡', label: 'Execute', key: 'execute' },
];

interface PipelineVizProps {
  active?: boolean;
  stages?: { name: string; success: boolean; detail: string }[];
}

export function PipelineViz({ active, stages }: PipelineVizProps) {
  const executedStages = new Set(stages?.filter((s) => s.success).map((s) => s.name) || []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-sage-surface/60 backdrop-blur-md border border-sage-border"
    >
      {STAGES.map((stage, i) => {
        const isDone = executedStages.has(stage.key);
        const isActive = active && !isDone && executedStages.size === i;

        return (
          <div key={stage.key} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`pipeline-dot ${
                  isDone ? 'done' : isActive ? 'active' : 'pending'
                }`}
              >
                {isDone ? '✓' : stage.icon}
              </div>
              <span
                className={`text-[9px] font-mono ${
                  isDone
                    ? 'text-status-success'
                    : isActive
                    ? 'text-accent-primary'
                    : 'text-txt-muted'
                }`}
              >
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={`w-6 h-[2px] mb-4 rounded-full transition-colors duration-500 ${
                  isDone ? 'bg-status-success/40' : 'bg-sage-border'
                }`}
              />
            )}
          </div>
        );
      })}
    </motion.div>
  );
}
