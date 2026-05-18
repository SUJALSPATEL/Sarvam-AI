// ============================================================
// components/playground/TextInput.tsx
// Compact auto-expanding — ChatGPT / Sarvam dashboard style
// ============================================================

import React, { useRef, useEffect } from 'react';
import { clsx } from 'clsx';

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  maxLength?: number;
}

const MAX_LENGTH = 4000;

export const TextInput: React.FC<TextInputProps> = ({
  value,
  onChange,
  onSubmit,
  disabled,
  maxLength = MAX_LENGTH,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const charCount = value.length;
  const pct = charCount / maxLength;
  const isNearLimit = pct > 0.8;
  const isAtLimit = pct >= 1;

  // Auto-resize — starts as one line, grows as needed
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const newHeight = Math.min(ta.scrollHeight, 320);
    ta.style.height = `${newHeight}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter alone = submit. Shift+Enter = newline (default behavior).
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor="prompt-textarea" className="sr-only">Enter your prompt</label>

      <textarea
        id="prompt-textarea"
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        maxLength={maxLength}
        placeholder="What's on your mind?"
        rows={1}
        className={clsx(
          'w-full bg-transparent',
          'text-[15px] leading-[1.65] resize-none outline-none',
          'disabled:cursor-not-allowed disabled:opacity-40',
          'transition-all duration-150',
          'min-h-[38px]'
        )}
        style={{
          color: '#ffffff',
          overflow: 'hidden',
        }}
        aria-label="Prompt input"
        aria-describedby="char-counter"
      />

      {/* Hint bar — shown only when typing */}
      <div
        className={clsx(
          'flex items-center justify-between pt-1.5 border-t border-white/6',
          'transition-all duration-200',
          value.length === 0 ? 'opacity-0 pointer-events-none h-0 pt-0 border-0' : 'opacity-100'
        )}
      >
        <p className="text-[10px] flex items-center gap-1 font-mono" style={{ color: 'rgba(255,255,255,0.28)' }}>
          <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[9px]">↵</kbd>
          <span className="ml-0.5">to submit · Shift+Enter for newline</span>
        </p>
        <span
          id="char-counter"
          className={clsx(
            'text-[10px] font-mono tabular-nums transition-colors duration-300',
            isAtLimit && 'text-red-400',
            isNearLimit && !isAtLimit && 'text-amber-400/70',
            !isNearLimit && 'text-white/25'
          )}
          aria-live="polite"
        >
          {charCount.toLocaleString()}
          <span className="opacity-40">/{maxLength.toLocaleString()}</span>
        </span>
      </div>
    </div>
  );
};
