/**
 * components/pages/ChatPage.tsx — 3-column Cognitive Workspace
 */
'use client';

import { useRef, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { Composer } from '@/components/chat/Composer';
import { Inspector } from '@/components/inspector/Inspector';
import { PipelineViz } from '@/components/chat/PipelineViz';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Brain } from 'lucide-react';

export function ChatPage() {
  const { messages, isProcessing, user } = useAppStore();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="max-w-7xl mx-auto flex gap-5 h-[calc(100vh-100px)]">
      {/* Center: Chat + Composer */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Pipeline visualization */}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <PipelineViz active />
          </motion.div>
        )}

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto pr-2 scroll-smooth">
          <AnimatePresence>
            {messages.length === 0 ? (
              <EmptyState userName={user?.name || 'Explorer'} />
            ) : (
              <div className="space-y-6 pb-4">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Composer */}
        <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-sage-bg via-sage-bg/95 to-transparent">
          <Composer />
        </div>
      </div>

      {/* Right: Inspector */}
      <div className="w-[280px] shrink-0 overflow-y-auto hidden lg:block">
        <Inspector />
      </div>
    </div>
  );
}

function EmptyState({ userName }: { userName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow-lg mb-6">
        <Brain className="w-8 h-8 text-white" />
      </div>
      <h2 className="font-display text-xl font-bold text-txt-primary mb-2">
        Welcome back, {userName}
      </h2>
      <p className="text-txt-secondary text-sm mb-8 max-w-md">
        How can I help accelerate your intelligence today? I can research, analyze, build, debug,
        explain, generate, summarize, plan, translate, or review anything.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {[
          { icon: '🔬', text: 'Research computational thinking and create study notes' },
          { icon: '🛠️', text: 'Build a REST API with Express and TypeScript' },
          { icon: '🧪', text: 'Analyze https://github.com and summarize the architecture' },
          { icon: '🐛', text: 'Debug this TypeError in my React component' },
        ].map((item) => (
          <button
            key={item.text}
            className="flex items-start gap-3 p-4 rounded-xl bg-sage-panel/60 border border-sage-border text-left hover:border-accent-primary/20 hover:bg-sage-hover transition-all duration-200 group"
          >
            <span className="text-lg mt-0.5">{item.icon}</span>
            <span className="text-[13px] text-txt-secondary group-hover:text-txt-primary transition-colors leading-relaxed">
              {item.text}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
