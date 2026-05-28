// ============================================================
// components/playground/MetricsPanel.tsx
// Floating live metrics panel — fixed middle-right
// ============================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { StreamMetrics } from '../../types';

interface MetricsPanelProps {
  metrics: StreamMetrics;
  cumulativeTokens: number;
  inputTokens: number;
  isVisible: boolean;
}

const fmt = (n: number) => n.toLocaleString();
const fmtTime = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const statusLabel: Record<string, { label: string; color: string }> = {
  idle:       { label: 'Idle',       color: 'rgba(255,255,255,0.25)' },
  streaming:  { label: 'Live',       color: '#4ade80' },
  complete:   { label: 'Done',       color: 'rgba(255,255,255,0.45)' },
  error:      { label: 'Error',      color: '#f87171' },
  cancelled:  { label: 'Stopped',   color: 'rgba(255,255,255,0.35)' },
};

interface MetricRowProps {
  label: string;
  value: string | number;
  mono?: boolean;
  highlight?: boolean;
}
const MetricRow: React.FC<MetricRowProps> = ({ label, value, mono = true, highlight }) => (
  <div className="flex items-center justify-between gap-4">
    <span
      className="text-[10px] uppercase tracking-[0.18em]"
      style={{ color: 'rgba(255,255,255,0.32)', fontFamily: mono ? "'JetBrains Mono', monospace" : undefined }}
    >
      {label}
    </span>
    <span
      className={mono ? 'font-mono' : ''}
      style={{
        fontSize: '13px',
        fontWeight: 500,
        color: highlight ? '#ffffff' : 'rgba(255,255,255,0.72)',
        fontFamily: mono ? "'JetBrains Mono', monospace" : undefined,
        letterSpacing: '-0.01em',
      }}
    >
      {value}
    </span>
  </div>
);

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  metrics,
  cumulativeTokens,
  inputTokens,
  isVisible,
}) => {
  const st = statusLabel[metrics.status] ?? statusLabel.idle;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 18, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 18, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="hidden sm:fixed sm:block sm:right-5 sm:top-1/2 sm:-translate-y-1/2 z-50 pointer-events-none"
          aria-label="Live streaming metrics"
          role="status"
        >
          <div
            className="w-[168px] rounded-2xl border overflow-hidden"
            style={{
              background: 'rgba(8, 8, 8, 0.92)',
              borderColor: 'rgba(255,255,255,0.09)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.04) inset, 0 24px 48px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-3.5 py-2.5 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.018)' }}
            >
              <span
                className="text-[9px] tracking-[0.3em] uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(255,255,255,0.28)' }}
              >
                Metrics
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background: st.color,
                    boxShadow: metrics.status === 'streaming' ? `0 0 6px ${st.color}` : 'none',
                    animation: metrics.status === 'streaming' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                  }}
                />
                <span style={{ fontSize: '10px', color: st.color, fontFamily: "'JetBrains Mono', monospace" }}>
                  {st.label}
                </span>
              </div>
            </div>

            {/* Metrics rows */}
            <div className="px-3.5 py-3 space-y-2.5">
              <MetricRow
                label="Total tkns"
                value={fmt(cumulativeTokens)}
                highlight={cumulativeTokens > 0}
              />
              <MetricRow
                label="Prompt tkns"
                value={fmt(inputTokens)}
              />
              <div
                className="h-px w-full"
                style={{ background: 'rgba(255,255,255,0.055)' }}
              />
              <MetricRow
                label="Tok/sec"
                value={metrics.status === 'streaming' ? `${fmt(metrics.tokensPerSecond)}/s` : '—'}
              />
              <MetricRow
                label="Latency"
                value={metrics.elapsedTime > 0 ? fmtTime(metrics.elapsedTime) : '—'}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
