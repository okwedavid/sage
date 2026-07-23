/**
 * components/pages/AgentsPage.tsx — Agent registry dashboard
 */
'use client';

import { motion } from 'framer-motion';
import { Bot, Zap, Globe, Eye, Mic, Palette, CheckCircle, Clock } from 'lucide-react';

const AGENTS = [
  {
    name: 'GeneralWorker',
    icon: <Bot className="w-7 h-7" />,
    color: '#667eea',
    status: 'active',
    description: 'Text research, explain, debug, build, plan, generate, summarize, translate, review.',
    capabilities: ['10 Task Types', '70B Parameters', 'Context-Aware'],
    model: 'llama-3.3-70b-versatile',
  },
  {
    name: 'WebWorker',
    icon: <Globe className="w-7 h-7" />,
    color: '#58a6ff',
    status: 'active',
    description: 'Fetches URLs, parses HTML with Cheerio, and analyzes web content with structured reports.',
    capabilities: ['URL Fetching', 'HTML Parsing', 'Web Analysis'],
    model: 'llama-3.3-70b-versatile',
  },
  {
    name: 'VisionWorker',
    icon: <Eye className="w-7 h-7" />,
    color: '#a78bfa',
    status: 'active',
    description: 'Multimodal image analysis — diagrams, screenshots, photos, charts, architecture diagrams.',
    capabilities: ['Image Analysis', 'Multi-Model Fallback', 'Base64 Input'],
    model: 'llama-4-scout-17b',
  },
  {
    name: 'AudioWorker',
    icon: <Mic className="w-7 h-7" />,
    color: '#3fb950',
    status: 'planned',
    description: 'Voice transcription via Whisper + text-to-speech responses. Coming Sprint 7.',
    capabilities: ['Whisper STT', 'TTS Output', 'Voice Commands'],
    model: 'whisper-large-v3',
  },
  {
    name: 'ImageGenWorker',
    icon: <Palette className="w-7 h-7" />,
    color: '#f093fb',
    status: 'planned',
    description: 'AI image generation for visual content creation. Coming Sprint 11.',
    capabilities: ['Image Generation', 'Style Transfer', 'Edit Existing'],
    model: 'TBD',
  },
];

export function AgentsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-txt-primary mb-2">Agent Registry</h1>
        <p className="text-txt-secondary">
          SAGE uses a plugin architecture. Each agent is a specialized AI worker routed by the pipeline.
        </p>
      </motion.div>

      {/* Pipeline info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-5"
      >
        <div className="text-[10px] font-bold tracking-[0.12em] text-txt-muted uppercase mb-3">
          Routing Priority
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-primary/10 border border-accent-primary/20">
            <Eye className="w-4 h-4 text-accent-primary" />
            <span className="text-txt-primary font-medium">Image → VisionWorker</span>
          </div>
          <span className="text-txt-muted">→</span>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-status-info/10 border border-status-info/20">
            <Globe className="w-4 h-4 text-status-info" />
            <span className="text-txt-primary font-medium">URL → WebWorker</span>
          </div>
          <span className="text-txt-muted">→</span>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-glow/10 border border-accent-glow/20">
            <Bot className="w-4 h-4 text-accent-glow" />
            <span className="text-txt-primary font-medium">Default → GeneralWorker</span>
          </div>
        </div>
      </motion.div>

      {/* Agents grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {AGENTS.map((agent, i) => (
          <motion.div
            key={agent.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * (i + 1) }}
            className="glass-card p-6 group hover:border-opacity-50 transition-all duration-300 hover:-translate-y-1"
            style={{ borderColor: `${agent.color}20` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: `${agent.color}15`, color: agent.color }}
                >
                  {agent.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-txt-primary">{agent.name}</h3>
                  <span className="font-mono text-[10px] text-txt-muted">{agent.model}</span>
                </div>
              </div>
              <span
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  agent.status === 'active'
                    ? 'bg-status-success/10 text-status-success'
                    : 'bg-status-warning/10 text-status-warning'
                }`}
              >
                {agent.status === 'active' ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <Clock className="w-3 h-3" />
                )}
                {agent.status === 'active' ? 'Active' : 'Planned'}
              </span>
            </div>

            <p className="text-sm text-txt-secondary leading-relaxed mb-4">{agent.description}</p>

            <div className="flex flex-wrap gap-2">
              {agent.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-sage-input border border-sage-border text-txt-secondary"
                >
                  {cap}
                </span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
