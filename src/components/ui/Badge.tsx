// ============================================================
// components/ui/Badge.tsx — Enterprise status badge
// ============================================================

import React from 'react';
import { clsx } from 'clsx';
import type { StreamStatus } from '../../types';

interface BadgeProps {
  status: StreamStatus;
  className?: string;
}

const statusConfig: Record<StreamStatus, { label: string; dotClass: string; wrapClass: string }> = {
  idle: {
    label: 'Ready',
    dotClass: 'bg-white/20',
    wrapClass: 'bg-white/3 text-white/30 border-white/8',
  },
  streaming: {
    label: 'Generating',
    dotClass: 'bg-white/70 animate-pulse',
    wrapClass: 'bg-white/5 text-white/55 border-white/10',
  },
  complete: {
    label: 'Complete',
    dotClass: 'bg-green-400',
    wrapClass: 'bg-green-950/30 text-green-400/80 border-green-900/40',
  },
  error: {
    label: 'Error',
    dotClass: 'bg-red-400',
    wrapClass: 'bg-red-950/30 text-red-400/80 border-red-900/40',
  },
  cancelled: {
    label: 'Stopped',
    dotClass: 'bg-white/30',
    wrapClass: 'bg-white/3 text-white/35 border-white/8',
  },
  network_lost: {
    label: 'Network Lost',
    dotClass: 'bg-yellow-400',
    wrapClass: 'bg-yellow-950/30 text-yellow-400/80 border-yellow-900/40',
  },
};

export const Badge: React.FC<BadgeProps> = ({ status, className }) => {
  const config = statusConfig[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full',
        'text-[10px] font-medium border tracking-wide',
        'transition-all duration-400',
        config.wrapClass,
        className
      )}
      aria-label={`Stream status: ${config.label}`}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', config.dotClass)} />
      {config.label}
    </span>
  );
};
