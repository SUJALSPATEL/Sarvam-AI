// ============================================================
// components/ui/Toast.tsx — Enterprise notification toasts
// ============================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { ToastMessage } from '../../types';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

const toastConfig = {
  success: {
    icon: CheckCircle,
    classes: 'bg-black border-green-900/50 text-green-300/90',
    iconClass: 'text-green-400',
  },
  error: {
    icon: XCircle,
    classes: 'bg-black border-red-900/50 text-red-300/90',
    iconClass: 'text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'bg-black border-amber-900/50 text-amber-300/90',
    iconClass: 'text-amber-400',
  },
  info: {
    icon: Info,
    classes: 'bg-black border-white/10 text-white/60',
    iconClass: 'text-white/50',
  },
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map(toast => {
          const config = toastConfig[toast.type];
          const Icon = config.icon;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className={clsx(
                'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl',
                'border backdrop-blur-2xl max-w-sm shadow-2xl shadow-black/60',
                config.classes
              )}
              role="alert"
            >
              <Icon className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', config.iconClass)} />
              <p className="text-sm flex-1 font-medium leading-snug">{toast.message}</p>
              <button
                onClick={() => onRemove(toast.id)}
                className="flex-shrink-0 opacity-30 hover:opacity-70 transition-opacity mt-0.5"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
