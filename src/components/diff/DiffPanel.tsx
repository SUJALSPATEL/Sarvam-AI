// ============================================================
// components/diff/DiffPanel.tsx — Model response panel
// Supports: streaming live text, diff tokens, status badges
// ============================================================

import React, { useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle } from 'lucide-react';
import { TokenSpan } from './TokenSpan';
import type { DiffToken } from '../../types';
import { copyToClipboard } from '../../utils/clipboard';
import { Copy, Check } from 'lucide-react';

export type PanelStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error' | 'network_lost' | 'timeout';

type CodeBlock = { type: 'code'; language: string; tokens: DiffToken[] };
type TextBlock = { type: 'text'; tokens: DiffToken[] };
type Block = CodeBlock | TextBlock;

const CodeBlockCopyButton = ({ tokens }: { tokens: DiffToken[] }) => {
  const [copied, setCopied] = React.useState(false);
  
  const handleCopy = async () => {
    const textToCopy = tokens.map(t => t.token).join('');
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

interface DiffPanelProps {
  label: string;
  modelName: string;
  /** Raw streaming text (shown while generating) */
  streamText: string;
  /** Diff-annotated tokens (shown after diff runs) */
  tokens: DiffToken[] | null;
  status: PanelStatus;
  latencyMs: number | null;
  tokensPerSec: number | null;
  tokenCount: number;
  errorMsg?: string;
  side: 'left' | 'right';
  addedCount: number;
  removedCount: number;
}

const STATUS_CONFIG: Record<PanelStatus, { dot: string; label: string; pulse: boolean }> = {
  idle:      { dot: 'bg-white/15',        label: 'Idle',       pulse: false },
  loading:   { dot: 'bg-amber-400/70',    label: 'Connecting', pulse: true  },
  streaming: { dot: 'bg-emerald-400/80',  label: 'Streaming',  pulse: true  },
  done:      { dot: 'bg-emerald-400/60',  label: 'Complete',   pulse: false },
  error:     { dot: 'bg-red-400/70',      label: 'Error',      pulse: false },
  network_lost: { dot: 'bg-amber-500/80', label: 'Offline',    pulse: false },
  timeout:   { dot: 'bg-amber-400/80',    label: 'Timeout',    pulse: false },
};

export const DiffPanel: React.FC<DiffPanelProps> = ({
  label,
  modelName,
  streamText,
  tokens,
  status,
  latencyMs,
  tokensPerSec,
  tokenCount,
  errorMsg,
  side,
  addedCount,
  removedCount,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll during streaming
  useEffect(() => {
    if (status === 'streaming' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamText, status]);

  const { dot, label: statusLabel, pulse } = STATUS_CONFIG[status];
  const isLeft = side === 'left';
  const sideAccent = isLeft
    ? 'text-red-400/55 bg-red-950/20 border-red-900/25'
    : 'text-emerald-400/55 bg-emerald-950/20 border-emerald-900/25';

  // Content to display
  const showDiff    = tokens !== null && tokens.length > 0 && status === 'done';
  const showStream  = (status === 'streaming' || status === 'loading' || status === 'error' || status === 'network_lost' || status === 'timeout') && !showDiff;
  const showError   = status === 'error';
  const showIdle    = status === 'idle';

  return (
    <div className="card-enterprise flex flex-col" style={{ minHeight: 320 }}>

      {/* ── Panel header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.015] flex-shrink-0">

        {/* Left: label badge + model name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={clsx(
            'text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-[0.2em] font-mono border flex-shrink-0',
            sideAccent
          )}>
            {label}
          </span>
          <span
            className="text-xs font-semibold text-white/80 truncate"
            title={modelName}
          >
            {modelName}
          </span>
        </div>

        {/* Right: status + metrics */}
        <div className="flex items-center gap-2.5 flex-shrink-0">

          {/* Token count badge */}
          {tokenCount > 0 && (
            <span className="text-[10px] font-mono text-white/30 px-2 py-0.5 rounded-md border border-white/6 bg-white/2">
              {tokenCount} tok
            </span>
          )}

          {/* Latency */}
          {latencyMs !== null && status === 'done' && (
            <span className="text-[10px] font-mono text-white/35 hidden sm:block">
              {latencyMs < 1000 ? `${latencyMs}ms` : `${(latencyMs / 1000).toFixed(1)}s`}
            </span>
          )}

          {/* Tok/s */}
          {tokensPerSec !== null && status === 'done' && tokensPerSec > 0 && (
            <span className="text-[10px] font-mono text-white/30 hidden sm:block">
              {tokensPerSec} t/s
            </span>
          )}

          {/* Diff badge */}
          {status === 'done' && tokens !== null && (
            <span className={clsx(
              'text-[10px] font-mono px-2 py-0.5 rounded-md border',
              isLeft
                ? 'bg-red-950/20 border-red-900/25 text-red-400/60'
                : 'bg-emerald-950/20 border-emerald-900/25 text-emerald-400/60'
            )}>
              {isLeft ? `−${removedCount}` : `+${addedCount}`}
            </span>
          )}

          {/* Status indicator */}
          <div className="flex items-center gap-1.5">
            <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dot, pulse && 'animate-pulse')} />
            <span className="text-[10px] font-mono text-white/35 hidden sm:block">{statusLabel}</span>
          </div>
        </div>
      </div>

      {/* ── Content area ──────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 p-5 overflow-y-auto text-xs leading-[1.85] text-white/85 whitespace-pre-wrap break-words"
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace" }}
        aria-label={`${modelName} output`}
        aria-live={status === 'streaming' ? 'polite' : undefined}
      >

        {/* Idle state */}
        {showIdle && (
          <div className="h-full flex flex-col items-center justify-center py-14 gap-3">
            <div
              className="w-8 h-8 rounded-xl border border-white/8 flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.025)' }}
            >
              <span className="text-white/20 text-xs font-bold font-mono">{label}</span>
            </div>
            <p className="text-white/20 text-xs text-center font-mono">
              Awaiting generation…
            </p>
          </div>
        )}

        {/* Connecting / loading */}
        {status === 'loading' && (
          <div className="h-full flex flex-col items-center justify-center py-14 gap-3">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full bg-white/30 animate-pulse"
                  style={{ animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </div>
            <p className="text-white/25 text-xs font-mono">Connecting to {modelName}…</p>
          </div>
        )}

        {/* Streaming raw text */}
        {showStream && streamText && (
          <>
            <span className="text-white/80">{streamText}</span>
            <span
              className="cursor-blink"
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: '1.5px',
                height: '0.9em',
                background: 'rgba(255,255,255,0.75)',
                marginLeft: '2px',
                verticalAlign: 'text-bottom',
                borderRadius: '1px',
                animation: 'blink 1.05s step-end infinite',
              }}
            />
          </>
        )}

        {/* Diff tokens */}
        {showDiff && tokens && (
          <div>
            {(() => {
              const blocks: Block[] = [];
              let currentBlock: Block = { type: 'text', tokens: [] };
              let insideCode = false;

              for (const t of tokens) {
                // Check if token contains ``` (it might have spaces or newlines attached, but usually it's just the backticks or backticks+language)
                if (!insideCode && t.token.includes('```')) {
                  if (currentBlock.tokens.length > 0) blocks.push(currentBlock);
                  const langMatch = t.token.match(/```([a-zA-Z0-9_-]*)/);
                  const lang = langMatch ? langMatch[1] : '';
                  currentBlock = { type: 'code', language: lang, tokens: [] };
                  insideCode = true;
                  // We don't push the ``` token itself to avoid rendering it inside the code block
                } else if (insideCode && t.token.includes('```')) {
                  if (currentBlock.tokens.length > 0) blocks.push(currentBlock);
                  currentBlock = { type: 'text', tokens: [] };
                  insideCode = false;
                } else {
                  currentBlock.tokens.push(t);
                }
              }
              if (currentBlock.tokens.length > 0) blocks.push(currentBlock);

              return blocks.map((block, i) => {
                if (block.type === 'code') {
                  return (
                    <div key={i} className="my-3 rounded-lg overflow-hidden border border-white/10 bg-[#161616]">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0e0e0e] border-b border-white/5">
                        <span className="text-[10px] font-mono text-white/40">{block.language || 'code'}</span>
                        <CodeBlockCopyButton tokens={block.tokens} />
                      </div>
                      <div className="p-3 overflow-x-auto">
                        <code className="text-[13px] leading-relaxed font-mono text-white/80 whitespace-pre">
                          {block.tokens.map((t, j) => <TokenSpan key={j} token={t} />)}
                        </code>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <span key={i}>
                      {block.tokens.map((t, j) => <TokenSpan key={j} token={t} />)}
                    </span>
                  );
                }
              });
            })()}
          </div>
        )}

        {/* Error */}
        {showError && !streamText && (
          <div className="h-full flex flex-col items-center justify-center py-14 gap-2">
            <span className="text-red-400/60 text-xs font-mono text-center break-all px-2">
              {errorMsg ?? 'Generation failed'}
            </span>
          </div>
        )}

        {/* Inline Error Badges */}
        {status === 'network_lost' && (
          <div className="mt-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-red-900/30 bg-red-950/20 text-red-400/80 text-[10px] font-mono">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Internet Lost</span>
            </div>
          </div>
        )}
        {status === 'timeout' && (
          <div className="mt-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-amber-900/30 bg-amber-950/20 text-amber-400/80 text-[10px] font-mono">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Model Timeout</span>
            </div>
          </div>
        )}
        {status === 'error' && streamText && (
          <div className="mt-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-red-900/30 bg-red-950/20 text-red-400/80 text-[10px] font-mono">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Connection Interrupted</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
