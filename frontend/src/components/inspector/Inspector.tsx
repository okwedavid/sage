/**
 * components/inspector/Inspector.tsx — Right panel intelligence display
 */
'use client';

import { useAppStore } from '@/stores/appStore';
import { TASK_COLORS, PRIORITY_COLORS } from '@/lib/utils';
import {
  Globe,
  Eye,
  Palette,
  Mic,
  Volume2,
  BarChart3,
  CheckCircle2,
  TrendingUp,
  Clock,
} from 'lucide-react';

const TOOLS = [
  { icon: <Globe className="w-4 h-4" />, name: 'Web Search', desc: 'Search the internet', color: '#58a6ff' },
  { icon: <Eye className="w-4 h-4" />, name: 'Image Analysis', desc: 'Analyze images', color: '#a78bfa' },
  { icon: <Palette className="w-4 h-4" />, name: 'Image Gen', desc: 'Generate images', color: '#f093fb' },
  { icon: <Mic className="w-4 h-4" />, name: 'Voice Input', desc: 'Speak your query', color: '#3fb950' },
  { icon: <Volume2 className="w-4 h-4" />, name: 'Text to Speech', desc: 'Listen to responses', color: '#f0883e' },
];

export function Inspector() {
  const { currentIntent, queryCount, successCount } = useAppStore();
  const rate = queryCount > 0 ? ((successCount / queryCount) * 100).toFixed(1) : '100.0';

  return (
    <div className="space-y-4">
      {/* Tools panel */}
      <div className="glass-card p-4">
        <div className="text-[10px] font-bold tracking-[0.12em] text-txt-muted uppercase mb-3">
          Tools
        </div>
        <div className="space-y-2">
          {TOOLS.map((tool) => (
            <div key={tool.name} className="tool-item">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${tool.color}12`, color: tool.color }}
              >
                {tool.icon}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-txt-primary truncate">{tool.name}</div>
                <div className="text-[10px] text-txt-muted truncate">{tool.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Session stats */}
      <div className="glass-card p-4">
        <div className="text-[10px] font-bold tracking-[0.12em] text-txt-muted uppercase mb-3">
          Session Stats
        </div>
        <div className="space-y-2">
          <StatRow icon={<BarChart3 className="w-3.5 h-3.5" />} label="Total Queries" value={String(queryCount)} />
          <StatRow icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Successful" value={String(successCount)} />
          <StatRow
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            label="Success Rate"
            value={`${rate}%`}
            valueColor="#3fb950"
          />
          <StatRow
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Avg Response"
            value="4.2s"
            valueColor="#3fb950"
          />
        </div>
      </div>

      {/* Intent inspector */}
      <div className="glass-card p-4">
        <div className="text-[10px] font-bold tracking-[0.12em] text-txt-muted uppercase mb-3">
          Intent Inspector
        </div>
        {currentIntent ? (
          <div className="space-y-2">
            <InspectorRow label="Task Type" value={currentIntent.task_type} color={TASK_COLORS[currentIntent.task_type]} />
            <InspectorRow label="Domain" value={currentIntent.target_domain} />
            <InspectorRow label="Priority" value={currentIntent.priority} color={PRIORITY_COLORS[currentIntent.priority]} />
            <InspectorRow label="Output" value={currentIntent.output_format} />
            <InspectorRow label="Agent" value={currentIntent.suggested_agent} color="#a78bfa" />
            <InspectorRow
              label="Confidence"
              value={`${(currentIntent.confidence_score * 100).toFixed(0)}%`}
              color="#3fb950"
            />
            <InspectorRow label="Status" value={`${currentIntent.status} ✅`} color="#3fb950" />
          </div>
        ) : (
          <div className="text-center py-4 text-txt-muted text-[11px]">
            No active intent
            <br />
            <span className="text-[10px]">Send a message to see inspector</span>
          </div>
        )}
      </div>

      {/* Branding */}
      <div className="rounded-xl bg-gradient-card border border-sage-border p-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-primary flex items-center justify-center">
            <span className="text-xs">🧠</span>
          </div>
          <span className="font-display font-bold text-txt-primary text-sm">SAGE v7.0</span>
        </div>
        <div className="text-[10px] text-txt-secondary leading-relaxed">
          Systemic Agentic
          <br />
          General Engine
        </div>
        <div className="mt-2 text-[10px] text-txt-muted italic">
          Think. Understand.
          <br />
          Act. Evolve.
        </div>
      </div>
    </div>
  );
}

function StatRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="flex items-center gap-2 text-xs text-txt-secondary">
        <span className="text-txt-muted">{icon}</span>
        {label}
      </span>
      <span
        className="text-xs font-mono font-semibold"
        style={{ color: valueColor || '#e4e4e7' }}
      >
        {value}
      </span>
    </div>
  );
}

function InspectorRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-sage-border/50 last:border-0">
      <span className="text-[11px] text-txt-muted">{label}</span>
      <span
        className="text-[11px] font-mono font-semibold truncate max-w-[140px]"
        style={{ color: color || '#e4e4e7' }}
      >
        {value}
      </span>
    </div>
  );
}
