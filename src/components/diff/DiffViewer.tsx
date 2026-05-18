// ============================================================
// components/diff/DiffViewer.tsx — Sarvam Model Evaluation
// Sarvam 30B vs Sarvam 105B comparison
// ============================================================

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitCompare, Send, RotateCcw, Info, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { DiffPanel, type PanelStatus } from './DiffPanel';
import { computeTokenDiff, getDiffStats } from '../../algorithms/tokenDiff';
import { streamBothModels } from '../../services/diffStreamService';
import type { DiffToken } from '../../types';

// Fixed model IDs for Sarvam comparison
const MODEL_A_ID = 'sarvam-30b';
const MODEL_B_ID = 'sarvam-105b';
const MODEL_A_LABEL = 'Sarvam 30B';
const MODEL_B_LABEL = 'Sarvam 105B';

// Removed ModelSelect

// ── Analytics metric card ────────────────────────────────────
const Metric: React.FC<{ label: string; value: string | number; accent?: string; mono?: boolean }> = ({
  label, value, accent, mono
}) => (
  <div className="flex flex-col gap-1 px-3.5 py-2.5 rounded-xl border border-white/7 bg-white/[0.018]">
    <span className="text-[9px] font-mono text-white/35 uppercase tracking-[0.15em]">{label}</span>
    <span className={clsx('text-sm font-semibold leading-tight', accent ?? 'text-white/80', mono && 'font-mono')}>{value}</span>
  </div>
);

// ── Main DiffViewer ──────────────────────────────────────────
interface ModelState {
  status: PanelStatus;
  streamText: string;
  finalText: string;
  tokens: DiffToken[] | null;
  latencyMs: number | null;
  tokensPerSec: number | null;
  tokenCount: number;
  errorMsg: string | undefined;
  startTime: number | null;
}

const initModel = (): ModelState => ({
  status: 'idle',
  streamText: '',
  finalText: '',
  tokens: null,
  latencyMs: null,
  tokensPerSec: null,
  tokenCount: 0,
  errorMsg: undefined,
  startTime: null,
});

export const DiffViewer: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [modelA, setModelA] = useState<ModelState>(initModel());
  const [modelB, setModelB] = useState<ModelState>(initModel());
  const [showLegend, setShowLegend] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const abortA = useRef<AbortController | null>(null);
  const abortB = useRef<AbortController | null>(null);

  // Monitor network connectivity globally
  React.useEffect(() => {
    const handleNetworkChange = () => {
      if (!navigator.onLine && isRunning) {
        abortA.current?.abort();
        abortB.current?.abort();
        setModelA(s => ({ ...s, status: 'network_lost' }));
        setModelB(s => ({ ...s, status: 'network_lost' }));
        setIsRunning(false);
      }
    };
    window.addEventListener('offline', handleNetworkChange);
    return () => window.removeEventListener('offline', handleNetworkChange);
  }, [isRunning]);

  // ── Diff: run once both are done ────────────────────────────
  const runDiff = useCallback((textA: string, textB: string) => {
    if (!textA || !textB) return;
    const result = computeTokenDiff(textA, textB);
    setModelA(s => ({ ...s, tokens: result.tokensA }));
    setModelB(s => ({ ...s, tokens: result.tokensB }));
  }, []);

  // ── Consume a stream into state ──────────────────────────────
  const consumeStream = useCallback(async (
    stream: ReadableStream<string>,
    startTime: number,
    setter: React.Dispatch<React.SetStateAction<ModelState>>,
    onDone: (text: string) => void,
  ) => {
    setter(s => ({ ...s, status: 'streaming', startTime }));
    const reader = stream.getReader();
    let accumulated = '';
    let chunkCount = 0;
    let timeoutId: NodeJS.Timeout;

    const resetInactivityTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        reader.cancel();
        setter(s => ({ ...s, status: 'timeout' }));
        onDone('');
      }, 20000); // 20 seconds inactivity timeout
    };

    try {
      if (!navigator.onLine) {
        setter(s => ({ ...s, status: 'network_lost' }));
        return;
      }

      resetInactivityTimeout();

      while (true) {
        if (!navigator.onLine) {
          reader.cancel();
          setter(s => ({ ...s, status: 'network_lost' }));
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;
        
        resetInactivityTimeout();
        accumulated += value;
        chunkCount++;
        const snap = accumulated;
        setter(s => ({
          ...s,
          streamText: snap,
          tokenCount: snap.split(/\s+/).filter(Boolean).length,
        }));
      }

      if (timeoutId!) clearTimeout(timeoutId);

      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);
      const wordCount = accumulated.split(/\s+/).filter(Boolean).length;
      const tokensPerSec = latencyMs > 0 ? Math.round((wordCount / latencyMs) * 1000) : 0;

      setter(s => ({
        ...s,
        status: 'done',
        finalText: accumulated,
        streamText: accumulated,
        latencyMs,
        tokensPerSec,
        tokenCount: wordCount,
      }));

      onDone(accumulated);
    } catch (err: unknown) {
      if (timeoutId!) clearTimeout(timeoutId);
      if ((err as Error)?.name === 'AbortError') {
        setter(s => ({ ...s, status: 'error', errorMsg: 'Cancelled' }));
      } else {
        setter(s => ({ ...s, status: 'error', errorMsg: (err as Error)?.message ?? 'Failed' }));
      }
      onDone('');
    }
  }, []);

  // ── Run comparison ───────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (!prompt.trim() || isRunning) return;

    // Abort previous
    abortA.current?.abort();
    abortB.current?.abort();
    abortA.current = new AbortController();
    abortB.current = new AbortController();

    setIsRunning(true);
    setModelA({ ...initModel(), status: 'loading' });
    setModelB({ ...initModel(), status: 'loading' });

    let doneTextA = '';
    let doneTextB = '';
    let doneCount = 0;

    const checkBothDone = () => {
      doneCount++;
      if (doneCount === 2 && doneTextA && doneTextB) {
        runDiff(doneTextA, doneTextB);
        setIsRunning(false);
      } else if (doneCount === 2) {
        setIsRunning(false);
      }
    };

    try {
      const { resultA, resultB } = await streamBothModels(
        prompt.trim(),
        MODEL_A_ID,
        MODEL_B_ID,
        abortA.current.signal,
        abortB.current.signal,
      );

      // Consume both streams concurrently
      consumeStream(resultA.stream, resultA.startTime, setModelA, (text) => {
        doneTextA = text;
        checkBothDone();
      });

      consumeStream(resultB.stream, resultB.startTime, setModelB, (text) => {
        doneTextB = text;
        checkBothDone();
      });

    } catch (err: unknown) {
      if (!navigator.onLine || (err as Error)?.name === 'AbortError') return; // Handled by offline listener
      const msg = (err as Error)?.message ?? 'Failed to start generation';
      setModelA(s => ({ ...s, status: 'error', errorMsg: msg }));
      setModelB(s => ({ ...s, status: 'error', errorMsg: msg }));
      setIsRunning(false);
    }
  }, [prompt, isRunning, consumeStream, runDiff]);

  const handleStop = useCallback(() => {
    abortA.current?.abort();
    abortB.current?.abort();
    setIsRunning(false);
  }, []);

  const handleReset = useCallback(() => {
    abortA.current?.abort();
    abortB.current?.abort();
    setModelA(initModel());
    setModelB(initModel());
    setIsRunning(false);
    setPrompt('');
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRun();
  };

  // ── Diff analytics ───────────────────────────────────────────
  const diffStats = useMemo(() => {
    if (!modelA.tokens || !modelB.tokens) return null;
    return getDiffStats({ tokensA: modelA.tokens, tokensB: modelB.tokens });
  }, [modelA.tokens, modelB.tokens]);

  const bothDone = modelA.status === 'done' && modelB.status === 'done';

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2.5">
            <GitCompare className="w-4 h-4 text-white/30" />
            AI Model Comparison
          </h2>
          <p className="text-[11px] text-white/35 mt-0.5 font-mono">
            Dual-stream generation · Token-level LCS diff · Live analytics
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowLegend(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono text-white/40 border border-white/7 hover:bg-white/4 hover:text-white/60 transition-all duration-150"
          >
            <Info className="w-3 h-3" />Legend
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono text-white/40 border border-white/7 hover:bg-white/4 hover:text-white/60 transition-all duration-150"
          >
            <RotateCcw className="w-3 h-3" />Reset
          </button>
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showLegend && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl border border-white/6 bg-white/[0.015] flex flex-wrap gap-5">
              {[
                { cls: 'token-added',   label: 'Present only in Model B' },
                { cls: 'token-removed', label: 'Present only in Model A' },
                { cls: 'token-unchanged text-white/60', label: 'Identical tokens' },
              ].map(({ cls, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={clsx('px-2 py-0.5 text-xs font-mono rounded', cls)}>
                    token
                  </span>
                  <span className="text-xs text-white/40">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Prompt input ─────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-mono text-white/40 uppercase tracking-[0.16em]">
          Prompt
        </label>
        <div className="relative">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter a prompt and both Sarvam models will generate responses simultaneously…"
            rows={4}
            disabled={isRunning}
            className={clsx(
              'w-full px-4 py-3.5 pr-14 rounded-xl border bg-white/[0.018]',
              'text-sm text-white/85 placeholder:text-white/18',
              'outline-none transition-all duration-150 resize-none font-mono text-xs leading-[1.75]',
              isRunning
                ? 'border-white/6 opacity-60 cursor-not-allowed'
                : 'border-white/8 focus:border-white/16 focus:bg-white/3'
            )}
            aria-label="Comparison prompt"
          />
          <span className="absolute bottom-3 right-3 text-[10px] font-mono text-white/20">⌘↵</span>
        </div>

        {/* Run / Stop button */}
        <div className="flex justify-end">
          {isRunning ? (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-900/30 bg-red-950/20 text-red-400/70 text-sm font-medium hover:bg-red-950/35 transition-all duration-150"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-400/60 animate-pulse" />
              Stop Generation
            </button>
          ) : (
            <button
              onClick={handleRun}
              disabled={!prompt.trim()}
              className={clsx(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                prompt.trim()
                  ? 'bg-white text-black hover:bg-white/90 cursor-pointer'
                  : 'bg-white/8 text-white/25 cursor-not-allowed border border-white/6'
              )}
            >
              <Send className="w-3.5 h-3.5" />
              Compare Models
            </button>
          )}
        </div>
      </div>

      {/* ── Analytics strip (after both done) ────────────────── */}
      <AnimatePresence>
        {bothDone && diffStats && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Section label */}
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-white/25" />
              <span className="text-[10px] font-mono text-white/35 uppercase tracking-[0.15em]">Comparison Analytics</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              <Metric label="Similarity" value={`${diffStats.similarityPct}%`} accent="text-white/85" />
              <Metric label="Added Tokens" value={`+${diffStats.addedCount}`} accent="text-emerald-400/65" mono />
              <Metric label="Removed Tokens" value={`−${diffStats.removedCount}`} accent="text-red-400/65" mono />
              <Metric label="Unchanged" value={diffStats.unchangedCount} accent="text-white/45" mono />
              <Metric label="A Latency" value={modelA.latencyMs !== null ? (modelA.latencyMs < 1000 ? `${modelA.latencyMs}ms` : `${(modelA.latencyMs/1000).toFixed(1)}s`) : '—'} mono />
              <Metric label="B Latency" value={modelB.latencyMs !== null ? (modelB.latencyMs < 1000 ? `${modelB.latencyMs}ms` : `${(modelB.latencyMs/1000).toFixed(1)}s`) : '—'} mono />
              <Metric label="A Tok/s" value={modelA.tokensPerSec !== null ? `${modelA.tokensPerSec}` : '—'} mono />
              <Metric label="B Tok/s" value={modelB.tokensPerSec !== null ? `${modelB.tokensPerSec}` : '—'} mono />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Side-by-side panels ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minHeight: 320 }}>
        <DiffPanel
          label="30B"
          modelName={MODEL_A_LABEL}
          streamText={modelA.streamText}
          tokens={modelA.tokens}
          status={modelA.status}
          latencyMs={modelA.latencyMs}
          tokensPerSec={modelA.tokensPerSec}
          tokenCount={modelA.tokenCount}
          errorMsg={modelA.errorMsg}
          side="left"
          addedCount={diffStats?.addedCount ?? 0}
          removedCount={diffStats?.removedCount ?? 0}
        />
        <DiffPanel
          label="105B"
          modelName={MODEL_B_LABEL}
          streamText={modelB.streamText}
          tokens={modelB.tokens}
          status={modelB.status}
          latencyMs={modelB.latencyMs}
          tokensPerSec={modelB.tokensPerSec}
          tokenCount={modelB.tokenCount}
          errorMsg={modelB.errorMsg}
          side="right"
          addedCount={diffStats?.addedCount ?? 0}
          removedCount={diffStats?.removedCount ?? 0}
        />
      </div>

    </div>
  );
};
