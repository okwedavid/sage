/**
 * components/pages/DashboardPage.tsx — Main dashboard (concept image design)
 */
'use client';

import { useAppStore } from '@/stores/appStore';
import { motion } from 'framer-motion';
import {
  Stethoscope,
  FlaskConical,
  Microscope,
  TrendingUp,
  Clock,
  CheckCircle2,
  BarChart3,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { TASK_COLORS } from '@/lib/utils';

export function DashboardPage() {
  const { queryCount, successCount, setPage } = useAppStore();
  const rate = queryCount > 0 ? ((successCount / queryCount) * 100).toFixed(1) : '100.0';

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-8">
      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-txt-primary mb-2">
          AI-Powered Intelligence
        </h1>
        <p className="text-txt-secondary">
          Welcome back. Your cognitive engine is ready to process any task.
        </p>
      </motion.div>

      {/* Service cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-5"
      >
        <ServiceCard
          icon={<MessageSquare className="w-7 h-7" />}
          title="AI Conversations"
          description="Research, analyze, build, debug — 10 specialized task types with intelligent routing."
          color="#667eea"
          action="Start Chat"
          onClick={() => setPage('conversations')}
        />
        <ServiceCard
          icon={<FlaskConical className="w-7 h-7" />}
          title="Web Intelligence"
          description="Paste any URL and SAGE fetches, parses, and analyzes web content with structured reports."
          color="#a78bfa"
          action="Analyze URL"
          onClick={() => setPage('conversations')}
        />
        <ServiceCard
          icon={<Microscope className="w-7 h-7" />}
          title="Vision Analysis"
          description="Upload images for multimodal AI analysis — diagrams, screenshots, photos, charts."
          color="#58a6ff"
          action="Upload Image"
          onClick={() => setPage('conversations')}
        />
      </motion.div>

      {/* Stats + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Real-time monitoring */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 glass-card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-lg font-bold text-txt-primary">
                Real-time Monitoring
              </h2>
              <p className="text-xs text-txt-muted mt-1">Live pipeline performance metrics</p>
            </div>
            <div className="flex items-center gap-2 text-status-success text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-status-success animate-pulse-slow" />
              System Healthy
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<BarChart3 className="w-5 h-5" />}
              label="Total Queries"
              value={String(queryCount || 0)}
              color="#667eea"
            />
            <StatCard
              icon={<CheckCircle2 className="w-5 h-5" />}
              label="Successful"
              value={String(successCount || 0)}
              color="#3fb950"
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Success Rate"
              value={`${rate}%`}
              color="#a78bfa"
            />
            <StatCard
              icon={<Clock className="w-5 h-5" />}
              label="Avg Response"
              value="4.2s"
              color="#f0883e"
            />
          </div>
        </motion.div>

        {/* Pipeline status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6"
        >
          <h2 className="font-display text-lg font-bold text-txt-primary mb-4">Pipeline Status</h2>
          <div className="space-y-3">
            {[
              { name: 'Normalizer', status: 'active', icon: '📝' },
              { name: 'Classifier', status: 'active', icon: '🧠' },
              { name: 'Validator', status: 'active', icon: '🔍' },
              { name: 'Router', status: 'active', icon: '🔀' },
              { name: 'Executor', status: 'active', icon: '⚡' },
            ].map((stage) => (
              <div
                key={stage.name}
                className="flex items-center justify-between p-3 rounded-xl bg-sage-card/50 border border-sage-border/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{stage.icon}</span>
                  <span className="text-sm font-medium text-txt-primary">{stage.name}</span>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-status-success font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                  Ready
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Task types showcase */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-6"
      >
        <h2 className="font-display text-lg font-bold text-txt-primary mb-4">
          Supported Task Types
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {Object.entries(TASK_COLORS).map(([type, color]) => (
            <div
              key={type}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-sage-card/50 border border-sage-border/50 hover:border-opacity-50 transition-all cursor-pointer hover:-translate-y-0.5"
              style={{ borderColor: `${color}30` }}
              onClick={() => setPage('conversations')}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: color, boxShadow: `0 0 8px ${color}50` }}
              />
              <span className="text-xs font-mono font-semibold text-txt-primary">{type}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Quick start */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-card p-6"
      >
        <h2 className="font-display text-lg font-bold text-txt-primary mb-4">Quick Start</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            'Research quantum computing and create study notes',
            'Build a React component for a pricing table',
            'Explain how neural networks work with analogies',
            'Debug this TypeError: cannot read property of undefined',
          ].map((prompt) => (
            <button
              key={prompt}
              onClick={() => setPage('conversations')}
              className="text-left p-4 rounded-xl bg-sage-card/50 border border-sage-border hover:border-accent-primary/20 hover:bg-sage-hover transition-all duration-200 group"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm text-txt-secondary group-hover:text-txt-primary transition-colors">
                  {prompt}
                </span>
                <ArrowRight className="w-4 h-4 text-txt-muted group-hover:text-accent-primary shrink-0 mt-0.5 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function ServiceCard({
  icon,
  title,
  description,
  color,
  action,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="service-card group" onClick={onClick}>
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
        style={{ background: `${color}12`, border: `1px solid ${color}25` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <h3 className="text-lg font-semibold text-txt-primary mb-2 relative z-10">{title}</h3>
      <p className="text-sm text-txt-secondary leading-relaxed mb-5 relative z-10">{description}</p>
      <div className="flex items-center gap-2 text-sm font-medium relative z-10" style={{ color }}>
        {action}
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 mb-3" style={{ color }}>
        {icon}
        <span className="text-[10px] font-bold tracking-[0.08em] text-txt-muted uppercase">
          {label}
        </span>
      </div>
      <div className="text-2xl font-display font-bold text-txt-primary">{value}</div>
    </div>
  );
}
