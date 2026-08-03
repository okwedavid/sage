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
        <div className="msg-user text-[13px] md:text-[13.5px]">{message.content}</div>
        {message.attachments?.image_name && (
          <div className="flex items-center gap-2 mt-2 mr-1 px-2.5 md:px-3 py-1.5 rounded-lg bg-sage-panel border border-sage-border text-[10px] md:text-[11px] text-txt-secondary max-w-[90%]">
            <span className="text-accent-primary shrink-0">📎</span>
            <span className="truncate">{message.attachments.image_name}</span>
            <span className="text-status-success shrink-0">●</span>
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
      className="flex gap-2 md:gap-3"
    >
      {/* Avatar */}
      <div className="w-7 h-7 md:w-8 md:h-8 shrink-0 rounded-lg bg-sage-panel border border-sage-border flex items-center justify-center">
        <Brain className="w-3.5 h-3.5 md:w-4 md:h-4 text-txt-accent" />
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-1.5 md:gap-2 mb-2 text-[10px] md:text-[11px] text-txt-muted flex-wrap">
          <span className="font-semibold text-txt-secondary">SAGE</span>
          <span>·</span>
          <span>{message.timestamp}</span>
          {message.agent && (
            <>
              <span className="w-1 h-1 rounded-full bg-status-success" />
              <span className="text-status-success truncate">{message.agent}</span>
            </>
          )}
        </div>

        {/* Intent card */}
        {message.intent && <IntentCard intent={message.intent} />}

        {/* Response body */}
        <div className="response-card">
          {message.agent && (
            <div className="flex items-center justify-between px-3 md:px-4 py-2 md:py-2.5 bg-sage-card/60 border-b border-sage-border text-[10px] md:text-[11px] font-semibold text-txt-secondary">
              <span className="flex items-center gap-1.5 md:gap-2">
                <span className="text-status-info">📄</span>
                <span className="truncate">{message.agent} Intelligence Report</span>
              </span>
              <span className="text-txt-muted shrink-0 ml-2">{message.timestamp}</span>
            </div>
          )}
          <div className="px-3 md:px-5 py-3 md:py-5 markdown-body">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 md:px-2.5 py-1 rounded-lg text-[10px] md:text-[11px] text-txt-muted hover:text-txt-primary hover:bg-sage-hover transition-all"
          >
            {copied ? <Check className="w-2.5 h-2.5 md:w-3 md:h-3 text-status-success" /> : <Copy className="w-2.5 h-2.5 md:w-3 md:h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
