// ============================================================
// components/ui/Skeleton.tsx — Loading skeleton component
// ============================================================

import React from 'react';
import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  lines?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, lines = 1 }) => {
  if (lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={clsx(
              'h-4 rounded-lg shimmer',
              i === lines - 1 && 'w-3/4',
              className
            )}
          />
        ))}
      </div>
    );
  }

  return <div className={clsx('rounded-lg shimmer', className)} />;
};
