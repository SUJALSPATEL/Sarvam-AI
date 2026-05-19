// ============================================================
// components/playground/ChatBubble.tsx
// User + assistant message rendering with timestamps
// ============================================================

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, AlertTriangle, Check } from 'lucide-react';
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

const CodeBlockCopyButton = ({ textToCopy }: { textToCopy: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    const ok = await copyToClipboard(textToCopy);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-[10px] font-mono transition-colors hover:text-white"
      style={{ color: copied ? '#4ade80' : 'rgba(255,255,255,0.4)' }}
      aria-label="Copy code"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

// Extremely lightweight formatter to safely handle `**bold**`, inline `code`, and ```code blocks```
const renderFormattedText = (text: string, isStreamingActive: boolean) => {
  // 1. Split by code blocks first
  const blocks = text.split(/(\`\`\`[\s\S]*?\`\`\`)/g);
  
  return (
    <>
      {blocks.map((block, i) => {
        // Is this a code block?
        if (block.startsWith('```') && block.endsWith('```') && block.length >= 6) {
          const content = block.slice(3, -3);
          const firstNewlineIndex = content.indexOf('\n');
          let language = '';
          let code = content;
          
          if (firstNewlineIndex !== -1 && firstNewlineIndex < 20) {
            language = content.substring(0, firstNewlineIndex).trim();
            code = content.substring(firstNewlineIndex + 1);
          } else {
            code = content.trim();
          }

          return (
            <div key={i} className="my-3 rounded-lg overflow-hidden border border-white/10 bg-[#161616]">
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#0e0e0e] border-b border-white/5">
                <span className="text-[10px] font-mono text-white/40">{language || 'code'}</span>
                <CodeBlockCopyButton textToCopy={code} />
              </div>
              <div className="p-3 overflow-x-auto">
                <code className="text-[13px] leading-relaxed font-mono text-white/80 whitespace-pre">
                  {code}
                </code>
              </div>
            </div>
          );
        }

        // 2. Otherwise, it's normal text, apply bold parsing
        const boldParts = block.split(/(\*\*[\s\S]*?\*\*)/g);
        return (
          <React.Fragment key={i}>
            {boldParts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
                return <strong key={j} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
              }
              
              // 3. Apply inline code parsing
              const inlineParts = part.split(/(\`[^\`]+\`)/g);
              return inlineParts.map((inlinePart, k) => {
                if (inlinePart.startsWith('`') && inlinePart.endsWith('`') && inlinePart.length >= 2) {
                  return (
                    <code key={k} className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-[12.5px] text-white/90">
                      {inlinePart.slice(1, -1)}
                    </code>
                  );
                }
                return <React.Fragment key={k}>{inlinePart}</React.Fragment>;
              });
            })}
          </React.Fragment>
        );
      })}
      
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
    </>
  );
};

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  isStreamingActive,
  streamingContent,
  onCopySuccess,
}) => {
  const isUser      = message.role === 'user';
  const displayText = isStreamingActive && streamingContent ? streamingContent : message.content;
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(displayText);
    if (ok) {
      onCopySuccess();
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className={clsx('flex w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      <div className={clsx('relative group max-w-[88%]', isUser ? 'items-end' : 'items-start')}>

        {/* ── Role label ── */}
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
                  {renderFormattedText(displayText, !!isStreamingActive)}
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

        {/* ── Footer Row ── */}
        <div className={clsx('mt-1.5 flex items-center gap-4', isUser ? 'justify-end' : 'justify-start')}>
          <p
            className="text-[10px] font-mono select-none"
            style={{ color: 'rgba(255,255,255,0.20)' }}
            aria-label={`Sent at ${formatTime(message.timestamp)}`}
          >
            {formatTime(message.timestamp)}
          </p>

          {!isUser && message.status === 'cancelled' && (
            <span className="text-[10px] font-mono select-none" style={{ color: 'rgba(255,255,255,0.35)' }}>
              • Response Stopped
            </span>
          )}

          {!isUser && !isStreamingActive && displayText && (
            <button
              onClick={handleCopy}
              className={clsx(
                "flex items-center gap-1.5 text-[10px] font-mono transition-opacity duration-200",
                isCopied ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
              style={{ color: isCopied ? '#4ade80' : 'rgba(255,255,255,0.3)' }}
              aria-label="Copy response"
            >
              <AnimatePresence mode="wait">
                {isCopied ? (
                  <motion.div key="check" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <Check className="w-3 h-3" />
                  </motion.div>
                ) : (
                  <motion.div key="copy" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <Copy className="w-3 h-3" />
                  </motion.div>
                )}
              </AnimatePresence>
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>

      </div>
    </motion.div>
  );
};
