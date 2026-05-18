// ============================================================
// hooks/useMetrics.ts — Real-time streaming metrics hook
// ============================================================

import { useState, useEffect, useRef } from 'react';
import type { StreamMetrics, StreamStatus } from '../types';

export function useMetrics(
  content: string,
  isStreaming: boolean,
  status: StreamStatus
): StreamMetrics {
  const [metrics, setMetrics] = useState<StreamMetrics>({
    tokenCount: 0,
    tokensPerSecond: 0,
    elapsedTime: 0,
    status: 'idle',
  });

  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const prevTokenCountRef = useRef<number>(0);
  const prevTimeRef = useRef<number>(0);

  // Approximate token count: words ≈ tokens (GPT tokenizer ~0.75 words/token)
  const estimateTokens = (text: string): number =>
    Math.round(text.split(/\s+/).filter(Boolean).length * 1.3);

  useEffect(() => {
    if (isStreaming && startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
      prevTimeRef.current = Date.now();
      prevTokenCountRef.current = 0;
    }

    if (!isStreaming) {
      startTimeRef.current = 0;
      cancelAnimationFrame(rafRef.current);
    }
  }, [isStreaming]);

  useEffect(() => {
    if (!isStreaming) {
      setMetrics(prev => ({ ...prev, status, isStreaming: false }));
      return;
    }

    const tick = () => {
      const now = Date.now();
      const elapsed = startTimeRef.current ? now - startTimeRef.current : 0;
      const tokenCount = estimateTokens(content);

      // Compute TPS over a sliding 500ms window
      const windowMs = now - prevTimeRef.current;
      let tps = 0;
      if (windowMs >= 500) {
        const deltaTokens = tokenCount - prevTokenCountRef.current;
        tps = Math.round((deltaTokens / windowMs) * 1000);
        prevTokenCountRef.current = tokenCount;
        prevTimeRef.current = now;
      } else {
        // Use cumulative average for smoother display
        tps = elapsed > 0 ? Math.round((tokenCount / elapsed) * 1000) : 0;
      }

      setMetrics({
        tokenCount,
        tokensPerSecond: Math.max(0, tps),
        elapsedTime: elapsed,
        status,
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isStreaming, content, status]);

  return metrics;
}
