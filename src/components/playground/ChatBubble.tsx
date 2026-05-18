// ============================================================
// components/playground/ChatBubble.tsx
// User + assistant message rendering with timestamps
// ============================================================

import React from 'react';
import { motion } from 'framer-motion';
import { Copy, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { copyToClipboard } from '../../utils/clipboard';
import type { ChatMessage } from '../../types';

interface ChatBubbleProps {
  message: ChatMessage;
  /** True only for the single active streaming message */
  isStreamingActive?: boolean;
  streamingContent?: string;
  onCopySuccess: () => void;
}

const formatTime = (ts: number): string => {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m} ${ampm}`;
};

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  isStreamingActive,
  streamingContent,
  onCopySuccess,
}) => {
  const isUser      = message.role === 'user';
  const displayText = isStreamingActive && streamingContent ? streamingContent : message.content;

  const handleCopy = async () => {
    const ok = await copyToClipboard(displayText);
    if (ok) onCopySuccess();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className={clsx('flex w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      <div className={clsx('relative group max-w-[88%]', isUser ? 'items-end' : 'items-start')}>

        {/* ── Role + copy row ── */}
        <div
          className={clsx(
            'mb-1.5 flex items-center gap-2',
            isUser ? 'justify-end' : 'justify-start'
          )}
        >
          <span
            className="text-[10px] tracking-[0.18em] uppercase font-mono"
            style={{ color: 'rgba(255,255,255,0.28)' }}
          >
            {isUser ? 'You' : 'Sarvam'}
          </span>

          {/* Copy button — assistant only, on hover */}
          {!isUser && !isStreamingActive && displayText && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              style={{ color: 'rgba(255,255,255,0.28)' }}
              aria-label="Copy response"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* ── Bubble ── */}
        <div
          className={clsx(
            'px-4 py-3 rounded-2xl',
            isUser
              ? 'bg-white/8 border border-white/10 rounded-tr-md'
              : 'bg-white/[0.032] border border-white/7 rounded-tl-md'
          )}
        >
          {isUser ? (
            <p
              className="text-[14px] leading-[1.7] whitespace-pre-wrap break-words"
              style={{ color: 'rgba(255,255,255,0.88)' }}
            >
              {message.content}
            </p>
          ) : (
            <>
              {/* Waiting for first token — animated dots */}
              {isStreamingActive && !displayText ? (
                <div className="flex items-center gap-1.5 py-1" aria-label="Generating…">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.35)' }}
                      animate={{ opacity: [0.35, 1, 0.35] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              ) : (
                <p
                  className="text-[14px] leading-[1.85] whitespace-pre-wrap break-words"
                  style={{ color: 'rgba(255,255,255,0.82)' }}
                  aria-live="polite"
                >
                  {displayText}
                  {/* Blinking cursor during streaming */}
                  {isStreamingActive && (
                    <span
                      className="inline-block w-[2px] h-[1em] ml-[2px] align-middle rounded-sm"
                      style={{
                        background: 'rgba(255,255,255,0.65)',
                        animation:  'blink 1.05s step-end infinite',
                      }}
                      aria-hidden="true"
                    />
                  )}
                </p>
              )}
              {/* Status badges */}
              {message.status === 'network_lost' && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded border border-red-900/30 bg-red-950/20 text-red-400/80 text-[10px] font-mono">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Internet Lost</span>
                </div>
              )}
              {message.status === 'timeout' && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded border border-amber-900/30 bg-amber-950/20 text-amber-400/80 text-[10px] font-mono">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Model Timeout</span>
                </div>
              )}
              {message.status === 'error' && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded border border-red-900/30 bg-red-950/20 text-red-400/80 text-[10px] font-mono">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Connection Interrupted</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Timestamp ── */}
        <p
          className={clsx(
            'mt-1 text-[10px] font-mono select-none',
            isUser ? 'text-right' : 'text-left'
          )}
          style={{ color: 'rgba(255,255,255,0.20)' }}
          aria-label={`Sent at ${formatTime(message.timestamp)}`}
        >
          {formatTime(message.timestamp)}
        </p>

      </div>
    </motion.div>
  );
};
