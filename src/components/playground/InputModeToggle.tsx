// ============================================================
// components/playground/InputModeToggle.tsx — Enterprise toggle
// ============================================================

import React from 'react';
import { motion } from 'framer-motion';
import { Type, Mic } from 'lucide-react';
import { clsx } from 'clsx';
import type { InputMode } from '../../types';

interface InputModeToggleProps {
  mode: InputMode;
  onChange: (mode: InputMode) => void;
  disabled?: boolean;
}

export const InputModeToggle: React.FC<InputModeToggleProps> = ({
  mode,
  onChange,
  disabled,
}) => {
  return (
    <div
      role="radiogroup"
      aria-label="Input mode"
      className="relative flex items-center bg-white/3 border border-white/6 rounded-lg p-0.5 gap-0.5 w-fit"
    >
      {(['text', 'audio'] as InputMode[]).map(m => {
        const isActive = mode === m;
        const Icon = m === 'text' ? Type : Mic;
        const label = m === 'text' ? 'Text' : 'Audio';

        return (
          <button
            key={m}
            role="radio"
            aria-checked={isActive}
            aria-label={`${label} input mode`}
            disabled={disabled}
            onClick={() => onChange(m)}
            className={clsx(
              'relative z-10 flex items-center gap-1.5 px-3.5 py-1.5 rounded-md',
              'text-xs font-medium transition-colors duration-150 cursor-pointer',
              'focus-visible:outline-2 focus-visible:outline-white/25 focus-visible:outline-offset-1',
              'disabled:opacity-35 disabled:cursor-not-allowed',
              isActive
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            {isActive && (
              <motion.div
                layoutId="mode-pill"
                className="absolute inset-0 bg-white/8 border border-white/10 rounded-md"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              <Icon className="w-3 h-3 opacity-60" />
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
