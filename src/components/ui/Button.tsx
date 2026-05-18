// ============================================================
// components/ui/Button.tsx — Enterprise minimal button
// ============================================================

import React from 'react';
import { clsx } from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-white text-black hover:bg-white/90 active:bg-white/80 border border-white/20 shadow-sm',
  secondary:
    'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-active)]',
  ghost:
    'bg-transparent hover:bg-white/5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border)]',
  danger:
    'bg-red-950/40 hover:bg-red-950/60 text-red-400 border border-red-900/50 hover:border-red-800/50',
  success:
    'bg-green-950/40 hover:bg-green-950/60 text-green-400 border border-green-900/50',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-md',
  md: 'px-4 py-2 text-sm gap-2 rounded-lg',
  lg: 'px-5 py-2.5 text-sm gap-2.5 rounded-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center font-medium',
          'transition-all duration-150 cursor-pointer',
          'focus-visible:outline-2 focus-visible:outline-white/30 focus-visible:outline-offset-2',
          'disabled:opacity-35 disabled:cursor-not-allowed',
          'select-none tracking-tight',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <span
              className={clsx(
                'w-3.5 h-3.5 border-[1.5px] rounded-full animate-spin flex-shrink-0',
                variant === 'primary' ? 'border-black/30 border-t-black' : 'border-white/20 border-t-white/70'
              )}
            />
            {children}
          </>
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <span className="flex-shrink-0 opacity-70">{icon}</span>
            )}
            {children}
            {icon && iconPosition === 'right' && (
              <span className="flex-shrink-0 opacity-70">{icon}</span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
