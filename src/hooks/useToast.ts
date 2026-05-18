// ============================================================
// hooks/useToast.ts — Toast notification state management
// ============================================================

import { useState, useCallback } from 'react';
import type { ToastMessage } from '../types';

interface UseToastReturn {
  toasts: ToastMessage[];
  addToast: (type: ToastMessage['type'], message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

let toastCounter = 0;

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (type: ToastMessage['type'], message: string, duration = 4000) => {
      const id = `toast-${++toastCounter}`;
      const toast: ToastMessage = { id, type, message, duration };

      setToasts(prev => [...prev, toast]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
      }
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
