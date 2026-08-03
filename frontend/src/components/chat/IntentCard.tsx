/**
 * components/chat/IntentCard.tsx — Intent metadata display
 */
'use client';

import { IntentData } from '@/stores/appStore';
import { TASK_COLORS, PRIORITY_COLORS } from '@/lib/utils';

export function IntentCard({ intent }: { intent: IntentData }) {
  const taskColor = TASK_COLORS[intent.task_type] || '#a1a1aa';
  const prioColor = PRIORITY_COLORS[intent.priority] || '#e3b341';

  return (
    <div className="intent-card mb-0 rounded-b-none p-3 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-status-success text-[10px] md:text-xs">✓</span>
        <span className="text-[10px] md:text-xs font-semibold text-txt-secondary">Intent Recognized</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        <IntentField label="Task Type" value={intent.task_type} color={taskColor} />
        <IntentField label="Domain" value={intent.target_domain} />
        <IntentField label="Priority" value={`⚡ ${intent.priority}`} color={prioColor} />
        <IntentField label="Output" value={intent.output_format} />
        <IntentField label="Agent" value={intent.suggested_agent} color="#a78bfa" />
        <IntentField
          label="Confidence"
          value={`${(intent.confidence_score * 100).toFixed(0)}%`}
          color="#3fb950"
        />
      </div>
    </div>
  );
}

function IntentField({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[8px] md:text-[9px] font-bold tracking-[0.08em] text-txt-muted uppercase">{label}</div>
      <div
        className="text-[9px] md:text-[10.5px] font-mono font-semibold px-2 py-1 md:py-1.5 rounded-lg bg-sage-input/80 border border-sage-border truncate"
        style={{ color: color || '#e4e4e7' }}
      >
        {value}
      </div>
    </div>
  );
}
