/**
 * components/chat/Composer.tsx — Universal input with pipeline execution
 */
'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { useAppStore, Message } from '@/stores/appStore';
import { api } from '@/lib/api';
import { generateId, formatTime } from '@/lib/utils';
import { Send, Paperclip, Mic, Globe, Image as ImageIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Composer() {
  const [text, setText] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const {
    addMessage,
    isProcessing,
    setProcessing,
    setCurrentIntent,
    incrementQuery,
    uploadedImage,
    setUploadedImage,
  } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && !uploadedImage) return;
    if (isProcessing) return;

    // Build user message
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: trimmed || '[Image attached] Analyze this image',
      timestamp: formatTime(),
      attachments: uploadedImage ? { image_name: uploadedImage.name } : {},
    };
    addMessage(userMsg);
    setText('');
    setProcessing(true);

    // Build request with image if present
    const attachments: Record<string, any> = {};
    if (uploadedImage) {
      attachments.image_base64 = uploadedImage.base64;
      attachments.image_type = uploadedImage.type;
      attachments.image_name = uploadedImage.name;
      
      console.log(`🖼️ Sending image: ${uploadedImage.name} (${uploadedImage.type})`);
    }

    try {
      const result = await api.chat({
        message: trimmed || '[Image attached] Analyze this image',
        attachments,
      });

      const assistantMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: result.response || 'No response',
        intent: result.intent,
        agent: result.agent || 'GeneralWorker',
        timestamp: formatTime(),
        stages: result.stages,
      };

      addMessage(assistantMsg);
      setCurrentIntent(result.intent);
      incrementQuery(result.success);
    } catch (error: any) {
      addMessage({
        id: generateId(),
        role: 'assistant',
        content: `⚠️ Error: ${error.message || 'Failed to process request. Make sure the backend is running.'}`,
        timestamp: formatTime(),
      });
      incrementQuery(false);
    } finally {
      setProcessing(false);
      setUploadedImage(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      const type = file.type.split('/')[1] || 'jpeg';
      
      console.log(`📎 Image uploaded: ${file.name} (${type}, ${Math.round(file.size / 1024)}KB)`);
      
      setUploadedImage({
        base64,
        type,
        name: file.name,
      });
    };
    reader.onerror = () => {
      alert('Failed to read image file');
    };
    reader.readAsDataURL(file);
    setShowAttach(false);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative">
      {/* Attachment preview */}
      <AnimatePresence>
        {uploadedImage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3"
          >
            <div className="inline-flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded-xl bg-sage-panel border border-accent-primary/20">
              <ImageIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-accent-primary shrink-0" />
              <span className="text-xs md:text-sm text-txt-primary truncate max-w-[200px] md:max-w-none">{uploadedImage.name}</span>
              <button
                onClick={() => setUploadedImage(null)}
                className="text-txt-muted hover:text-status-error transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer box */}
      <div className="glass-card p-2 md:p-3 glow-ring transition-all duration-200 focus-within:border-accent-primary/40">
        {/* Tool buttons */}
        <div className="flex items-center gap-1 mb-2">
          <button
            onClick={() => setShowAttach(!showAttach)}
            className="p-1.5 md:p-2 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-sage-hover transition-all"
            title="Attach image"
          >
            <Paperclip className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>
          <button
            className="p-1.5 md:p-2 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-sage-hover transition-all"
            title="Voice input"
          >
            <Mic className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>
          <button
            className="p-1.5 md:p-2 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-sage-hover transition-all"
            title="Paste URL"
          >
            <Globe className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>

          {/* Attach panel */}
          <AnimatePresence>
            {showAttach && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="ml-2"
              >
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 rounded-lg bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-[10px] md:text-xs font-medium hover:bg-accent-primary/20 transition-all"
                >
                  <ImageIcon className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  <span className="hidden sm:inline">Upload Image</span>
                  <span className="sm:hidden">Upload</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input area */}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... (text, URL, or upload image)"
            rows={1}
            className="flex-1 bg-transparent border-none outline-none resize-none text-[13px] md:text-[13.5px] text-txt-primary placeholder:text-txt-muted max-h-32 overflow-y-auto py-2 px-1"
            style={{ minHeight: '40px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 128) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={isProcessing || (!text.trim() && !uploadedImage)}
            className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-button flex items-center justify-center text-white shadow-glow-md hover:shadow-glow-lg transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-glow-md shrink-0"
          >
            {isProcessing ? (
              <div className="w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
            )}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
}
