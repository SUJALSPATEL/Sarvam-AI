// ============================================================
// hooks/useStreamingResponse.ts — Core streaming hook
//
// startStream now accepts the full conversation messages array
// so the Sarvam AI API receives proper conversation context.
// Includes network loss detection for graceful failure handling.
// ============================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { fetchSarvamStream } from '../services/streamService';
import type { SarvamMessage } from '../services/streamService';
import type { StreamStatus } from '../types';

interface UseStreamingResponseReturn {
  content: string;
  partialContent: string;
  isStreaming: boolean;
  status: StreamStatus;
  error: string | null;
  /** Pass the full conversation history (including new user message) */
  startStream: (messages: SarvamMessage[]) => Promise<void>;
  cancelStream: () => void;
  clearContent: () => void;
  retryStream: () => void;
}

export function useStreamingResponse(): UseStreamingResponseReturn {
  const [content, setContent]           = useState('');
  const [partialContent, setPartialContent] = useState('');
  const [isStreaming, setIsStreaming]   = useState(false);
  const [status, setStatus]             = useState<StreamStatus>('idle');
  const [error, setError]               = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastMessagesRef    = useRef<SarvamMessage[]>([]);
  const networkListenerRef = useRef<(() => void) | null>(null);
  const timeoutRef         = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearInactivityTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const resetInactivityTimeout = useCallback(() => {
    clearInactivityTimeout();
    timeoutRef.current = setTimeout(() => {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
      setStatus('timeout');
    }, 20000); // 20 seconds
  }, [clearInactivityTimeout]);

  // Monitor network connectivity
  useEffect(() => {
    const handleNetworkChange = () => {
      if (!navigator.onLine && isStreaming) {
        // Network lost during streaming
        abortControllerRef.current?.abort();
        setIsStreaming(false);
        setStatus('network_lost');
      }
    };

    const onOffline = () => handleNetworkChange();
    window.addEventListener('offline', onOffline);
    networkListenerRef.current = onOffline;

    return () => {
      if (networkListenerRef.current) {
        window.removeEventListener('offline', networkListenerRef.current);
      }
      clearInactivityTimeout();
    };
  }, [isStreaming, clearInactivityTimeout]);

  const startStream = useCallback(async (messages: SarvamMessage[]) => {
    if (!messages.length) return;

    // Cancel any in-flight request
    abortControllerRef.current?.abort();

    lastMessagesRef.current = messages;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setContent('');
    setPartialContent('');
    setError(null);
    setIsStreaming(true);
    setStatus('streaming');

    let accumulated = '';

    try {
      // Check network before starting
      if (!navigator.onLine) {
        setStatus('network_lost');
        setIsStreaming(false);
        return;
      }

      resetInactivityTimeout();
      const stream = await fetchSarvamStream(messages, controller.signal);
      const reader = stream.getReader();

      while (true) {
        // Check network health during streaming
        if (!navigator.onLine) {
          reader.cancel();
          setStatus('network_lost');
          break;
        }

        const { done, value } = await reader.read();
        if (done || controller.signal.aborted) break;

        resetInactivityTimeout();
        accumulated += value;
        setContent(accumulated);
        setPartialContent(accumulated);
      }

      clearInactivityTimeout();

      if (status !== 'network_lost' && status !== 'timeout' && !controller.signal.aborted) {
        setStatus('complete');
      }
    } catch (err) {
      clearInactivityTimeout();
      const e = err as Error;
      if (e.name === 'AbortError') {
        // Check if it's due to network loss
        if (!navigator.onLine) {
          setStatus('network_lost');
        } else {
          setStatus('cancelled');
        }
      } else {
        setError(e.message || 'An unexpected error occurred');
        setStatus('error');
      }
    } finally {
      setIsStreaming(false);
    }
  }, [status]);

  const cancelStream = useCallback(() => {
    clearInactivityTimeout();
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setStatus('cancelled');
  }, [clearInactivityTimeout]);

  const clearContent = useCallback(() => {
    clearInactivityTimeout();
    abortControllerRef.current?.abort();
    setContent('');
    setPartialContent('');
    setError(null);
    setStatus('idle');
    setIsStreaming(false);
  }, [clearInactivityTimeout]);

  const retryStream = useCallback(() => {
    if (lastMessagesRef.current.length > 0) {
      startStream(lastMessagesRef.current);
    }
  }, [startStream]);

  return {
    content,
    partialContent,
    isStreaming,
    status,
    error,
    startStream,
    cancelStream,
    clearContent,
    retryStream,
  };
}
