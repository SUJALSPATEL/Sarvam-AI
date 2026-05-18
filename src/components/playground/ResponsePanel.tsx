// ============================================================
// components/playground/ResponsePanel.tsx — "Sarvam says"
// Metrics displayed at top center above response content
// ============================================================

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, RefreshCw, AlertCircle, StopCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { MetricsBar } from './MetricsBar';
import { copyToClipboard } from '../../utils/clipboard';
import type { StreamStatus, StreamMetrics } from '../../types';

interface ResponsePanelProps {
  content: string;
  partialContent: string;
  isStreaming: boolean;
  status: StreamStatus;
  error: string | null;
  metrics: StreamMetrics;
  onCancel: () => void;
  onRetry: () => void;
  onCopySuccess: () => void;
}

export const ResponsePanel: React.FC<ResponsePanelProps> = ({
  content,
  partialContent,
  isStreaming,
  status,
  error,
  metrics,
  onCancel,
  onRetry,
  onCopySuccess,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasContent = content.length > 0 || partialContent.length > 0;
  const displayContent = content || partialContent;

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  const handleCopy = async () => {
    const success = await copyToClipboard(displayContent);
    if (success) onCopySuccess();
  };

  return (
    <div className="card-enterprise flex flex-col overflow-hidden">

      {/* ── Panel header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/1">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-white/50 tracking-wide">
            Sarvam says
          </span>
          <Badge status={status} />
        </div>

        <div className="flex items-center gap-1.5">
          {isStreaming && (
            <Button
              variant="danger"
              size="sm"
              icon={<StopCircle className="w-3.5 h-3.5" />}
              onClick={onCancel}
              aria-label="Cancel generation"
            >
              Stop
            </Button>
          )}
          {!isStreaming && hasContent && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Copy className="w-3.5 h-3.5" />}
              onClick={handleCopy}
              aria-label="Copy response to clipboard"
            >
              Copy
            </Button>
          )}
          {(status === 'error' || status === 'cancelled') && (
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={onRetry}
              aria-label="Retry generation"
            >
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* ── Metrics — top center, above response ── */}
      <div className="px-6 pt-5 pb-4 border-b border-white/4">
        <MetricsBar metrics={metrics} />
      </div>

      {/* ── Response content ── */}
      <div
        ref={scrollRef}
        className="overflow-y-auto px-6 py-5 min-h-[160px] max-h-[480px]"
        aria-live="polite"
        aria-atomic="false"
        aria-label="AI response output"
      >
        <AnimatePresence mode="wait">

          {/* Skeleton — very first tokens arriving */}
          {isStreaming && !hasContent && (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2.5 py-1"
            >
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3.5 w-3/4" />
            </motion.div>
          )}

          {/* Response text */}
          {hasContent && (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <p
                className="text-sm leading-[1.85] text-white/78 whitespace-pre-wrap break-words"
                style={{ fontFeatureSettings: '"cv11", "ss01"' }}
              >
                {displayContent}
                {isStreaming && <span className="cursor-blink" aria-hidden="true" />}
              </p>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Error state */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 flex items-start gap-3 p-4 rounded-xl bg-red-950/25 border border-red-900/30"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle className="w-4 h-4 text-red-400/70 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-300/80">Generation failed</p>
              <p className="text-xs text-red-400/50 mt-1 font-mono leading-relaxed">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Cancelled state */}
        {status === 'cancelled' && !error && hasContent && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 flex items-center gap-2.5 p-3 rounded-xl bg-white/3 border border-white/6"
          >
            <StopCircle className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
            <p className="text-[11px] text-white/30 font-mono">
              Generation stopped · partial output preserved above
            </p>
          </motion.div>
        )}

        {/* Network loss state */}
        {status === 'network_lost' && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 flex items-center gap-2.5 p-3 rounded-xl bg-yellow-950/25 border border-yellow-900/30"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle className="w-3.5 h-3.5 text-yellow-400/70 flex-shrink-0" />
            <p className="text-[11px] text-yellow-300/70 font-mono tracking-wide">
              Internet Lost
              {hasContent && ' · partial output preserved above'}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};
