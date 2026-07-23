/**
 * components/chat/ChatMessage.tsx — Individual message rendering
 */
'use client';

import { Message } from '@/stores/appStore';
import { IntentCard } from './IntentCard';
import { Brain, Copy, Check, User } from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';

export function ChatMessage({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);

  if (message.role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-end"
      >
        <div className="msg-user">{message.content}</div>
        {message.attachments?.image_name && (
          <div className="flex items-center gap-2 mt-2 mr-1 px-3 py-1.5 rounded-lg bg-sage-panel border border-sage-border text-[11px] text-txt-secondary">
            <span className="text-accent-primary">📎</span>
            {message.attachments.image_name}
            <span className="text-status-success">●</span>
          </div>
        )}
      </motion.div>
    );
  }

  // Assistant message
  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      {/* Avatar */}
      <div className="w-8 h-8 shrink-0 rounded-lg bg-sage-panel border border-sage-border flex items-center justify-center">
        <Brain className="w-4 h-4 text-txt-accent" />
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2 text-[11px] text-txt-muted">
          <span className="font-semibold text-txt-secondary">SAGE</span>
          <span>·</span>
          <span>{message.timestamp}</span>
          {message.agent && (
            <>
              <span className="w-1 h-1 rounded-full bg-status-success" />
              <span className="text-status-success">{message.agent}</span>
            </>
          )}
        </div>

        {/* Intent card */}
        {message.intent && <IntentCard intent={message.intent} />}

        {/* Response body */}
        <div className="response-card">
          {message.agent && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-sage-card/60 border-b border-sage-border text-[11px] font-semibold text-txt-secondary">
              <span className="flex items-center gap-2">
                <span className="text-status-info">📄</span>
                {message.agent} Intelligence Report
              </span>
              <span className="text-txt-muted">{message.timestamp}</span>
            </div>
          )}
          <div className="px-5 py-5 markdown-body">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] text-txt-muted hover:text-txt-primary hover:bg-sage-hover transition-all"
          >
            {copied ? <Check className="w-3 h-3 text-status-success" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
