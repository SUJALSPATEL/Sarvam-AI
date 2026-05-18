// ============================================================
// components/playground/MetricsBar.tsx — Prominent inference pills
// ============================================================

import React from 'react';
import { motion } from 'framer-motion';
import { formatTime, formatTokens } from '../../utils/formatters';
import type { StreamMetrics } from '../../types';

interface MetricsBarProps {
  metrics: StreamMetrics;
}

interface PillProps {
  label: string;
  value: string;
  isLive?: boolean;
  accent?: boolean;
}

const Pill: React.FC<PillProps> = ({ label, value, isLive, accent }) => (
  <motion.div
    layout
    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/8 bg-white/3 backdrop-blur-sm"
  >
    {/* Live dot */}
    {isLive && (
      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse flex-shrink-0" />
    )}
    <span className="text-[10px] text-white/30 uppercase tracking-[0.15em] font-mono select-none">
      {label}
    </span>
    <motion.span
      key={value}
      initial={{ opacity: 0.5, y: -1 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`text-xs font-mono tabular-nums font-medium ${accent ? 'text-white/80' : 'text-white/55'}`}
    >
      {value}
    </motion.span>
  </motion.div>
);

export const MetricsBar: React.FC<MetricsBarProps> = ({ metrics }) => {
  const isStreaming = metrics.status === 'streaming';

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-wrap items-center justify-center gap-2"
      aria-label="Inference metrics"
      role="status"
      aria-live="polite"
    >
      <Pill
        label="Tokens"
        value={formatTokens(metrics.tokenCount)}
        isLive={isStreaming}
        accent={isStreaming}
      />
      <Pill
        label="tok / s"
        value={isStreaming ? `${metrics.tokensPerSecond}` : '—'}
        accent={isStreaming}
      />
      <Pill
        label="Latency"
        value={metrics.elapsedTime > 0 ? formatTime(metrics.elapsedTime) : '—'}
      />
      <Pill
        label="Status"
        value={
          metrics.status === 'streaming' ? 'Streaming' :
          metrics.status === 'complete' ? 'Complete' :
          metrics.status === 'error' ? 'Error' :
          metrics.status === 'cancelled' ? 'Stopped' : 'Ready'
        }
      />
    </motion.div>
  );
};
