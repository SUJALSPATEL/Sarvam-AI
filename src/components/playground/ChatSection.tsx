// ============================================================
// components/playground/ChatSection.tsx
//
// Audio workflow — Web Speech API (SpeechRecognition):
//   • Mic button lives INSIDE the pill composer
//   • startListening() → live transcript updates textarea
//   • recognition ends → auto-submit (no user action needed)
//   • No file uploads, no placeholder messages
//   • Fallback: mic button disabled + tooltip if unsupported
//
// Scroll architecture — fixed container:
//   • position:fixed, top:64px — only container scrolls
//   • Eliminates all layout-shift / vibration
// ============================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, Square, ArrowUp, ArrowDown } from 'lucide-react';
import { ChatBubble } from './ChatBubble';
import { MetricsPanel } from './MetricsPanel';
import { useStreamingResponse } from '../../hooks/useStreamingResponse';
import { useMetrics } from '../../hooks/useMetrics';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import type { ChatMessage } from '../../types';

interface ChatSectionProps {
  onCopySuccess: () => void;
  onError: (msg: string) => void;
  onChatStarted?: () => void;
  /** Restore a previous conversation's messages */
  initialMessages?: ChatMessage[];
  /** Called with the latest messages when streaming completes */
  onConversationSave?: (messages: ChatMessage[]) => void;
  /** Sidebar offset in px — shift fixed containers right when sidebar open */
  sidebarWidth?: number;
}

const msgId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const MAX_TEXTAREA_HEIGHT = 200;
const HEADER_HEIGHT = 64;

// Format elapsed seconds as m:ss
const fmt = (s: number) =>
  s < 60 ? `0:${s.toString().padStart(2, '0')}` : `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

// Fixed waveform bar heights so they don't randomize each render
const WAVE_DELAYS = [0, 0.1, 0.2, 0.05, 0.15, 0.25, 0.08, 0.18, 0.28, 0.03, 0.13, 0.22];

export const ChatSection: React.FC<ChatSectionProps> = ({
  onCopySuccess,
  onError,
  onChatStarted,
  initialMessages = [],
  onConversationSave,
  sidebarWidth = 0,
}) => {
  // Initialize from a restored conversation if provided
  const [prompt, setPrompt]             = useState('');
  const [messages, setMessages]         = useState<ChatMessage[]>(initialMessages);
  const [isInChatMode, setIsInChatMode] = useState(initialMessages.length > 0);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [cumulativeTokens, setCumulativeTokens] = useState(0);

  const streamingMsgIdRef  = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef          = useRef<HTMLDivElement>(null);
  const textareaRef        = useRef<HTMLTextAreaElement>(null);
  const userScrolledUpRef  = useRef(false);

  const { content, partialContent, isStreaming, status, cancelStream, startStream } =
    useStreamingResponse();
  const metrics = useMetrics(content, isStreaming, status);

  // ── Core submit (accepts explicit text for voice auto-submit) ─
  const handleSubmitText = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || isStreaming) return;

    if (!isInChatMode) { setIsInChatMode(true); onChatStarted?.(); }

    setPrompt('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Build the full conversation history for Sarvam AI.
    // Snapshot `messages` NOW (before setState) — excludes the streaming placeholder.
    // Filter out empty assistant stubs (e.g. from cancelled requests).
    const apiMessages = [
      ...messages
        .filter(m => m.content.trim() && m.status !== 'streaming')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: clean },
    ];

    const userMsgId   = msgId();
    const assistantId = msgId();
    streamingMsgIdRef.current = assistantId;
    setStreamingMsgId(assistantId);

    setMessages(prev => [
      ...prev,
      { id: userMsgId,   role: 'user',      content: clean, timestamp: Date.now() },
      { id: assistantId, role: 'assistant',  content: '',    timestamp: Date.now(), status: 'streaming' },
    ]);

    userScrolledUpRef.current = false;

    try {
      await startStream(apiMessages); // ← full history, not just the latest prompt
    } catch {
      onError('Generation failed. Please try again.');
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, status: 'error' } : m)
      );
      setStreamingMsgId(null);
      streamingMsgIdRef.current = null;
    }
  }, [isStreaming, isInChatMode, messages, startStream, onError, onChatStarted]);


  const handleSubmit = useCallback(() => {
    handleSubmitText(prompt);
  }, [prompt, handleSubmitText]);

  // ── Voice input ───────────────────────────────────────────────
  const {
    voiceState,
    isSupported: isSpeechSupported,
    elapsedSeconds,
    startListening,
    stopListening,
  } = useVoiceInput({
    // Live: update textarea as words arrive
    onLiveTranscript: useCallback((text: string) => {
      setPrompt(text);
    }, []),
    // Final: auto-submit with the final text
    onFinalTranscript: useCallback((text: string) => {
      handleSubmitText(text);
    }, [handleSubmitText]),
    lang: 'en-US',
  });

  const isListening   = voiceState === 'listening';
  const isProcessing  = voiceState === 'processing';
  const isVoiceActive = isListening || isProcessing;

  const handleMicClick = useCallback(() => {
    if (isListening) { stopListening(); return; }
    if (!isVoiceActive) { startListening(); }
  }, [isListening, isVoiceActive, startListening, stopListening]);

  // ── Cumulative token tracking ──────────────────────────────
  useEffect(() => {
    if (status === 'complete' || status === 'cancelled') {
      setCumulativeTokens(prev => prev + metrics.tokenCount);
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Container scroll detection ─────────────────────────────
  useEffect(() => {
    if (!isInChatMode) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      userScrolledUpRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > 150;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [isInChatMode]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (userScrolledUpRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    if (behavior === 'instant') { el.scrollTop = el.scrollHeight; }
    else { el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }
  }, []);

  useEffect(() => {
    if (isInChatMode) { userScrolledUpRef.current = false; scrollToBottom('smooth'); }
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isStreaming && isInChatMode) scrollToBottom('instant');
  }, [content, isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync stream content into assistant message ─────────────
  useEffect(() => {
    const id = streamingMsgIdRef.current;
    if (!id) return;
    setMessages(prev =>
      prev.map(m => m.id === id ? { ...m, content: content || partialContent, status } : m)
    );
  }, [content, partialContent, status]);

  useEffect(() => {
    if (!isStreaming) {
      setStreamingMsgId(null);
      streamingMsgIdRef.current = null;
    }
  }, [isStreaming]);

  // ── Save conversation to localStorage when stream finishes ──
  useEffect(() => {
    if ((status === 'complete' || status === 'cancelled' || status === 'error') && messages.length > 0) {
      onConversationSave?.(messages);
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-resize textarea ────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [prompt]);

  // ── Keyboard & Focus ────────────────────────────────────────
  useEffect(() => {
    if (isInChatMode && !isStreaming) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isInChatMode, isStreaming]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if already typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      
      // Ignore command shortcuts or non-character keys
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) {
        return;
      }
      
      // Focus textarea to capture the character
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const canSubmit = !isStreaming && !isVoiceActive && prompt.trim().length > 0;

  // ════════════════════════════════════════════════════════════
  // PILL COMPOSER
  // ════════════════════════════════════════════════════════════
  const PillComposer = (
    <div className="w-full space-y-2">

      {/* Row above pill: Removed in favor of dynamic send/stop button */}
      <div className="h-2"></div>

      {/* The pill */}
      <div
        className="flex items-end gap-2 px-4 py-3 rounded-2xl border transition-colors duration-200"
        style={{
          background:  isListening
            ? 'rgba(239, 68, 68, 0.04)'
            : 'rgba(255,255,255,0.045)',
          borderColor: isListening
            ? 'rgba(239, 68, 68, 0.25)'
            : isStreaming
            ? 'rgba(255,255,255,0.13)'
            : 'rgba(255,255,255,0.09)',
          boxShadow: isListening
            ? '0 0 0 1px rgba(239,68,68,0.08) inset'
            : '0 0 0 1px rgba(255,255,255,0.03) inset',
        }}
      >
        {/* Textarea */}
        <div className="flex-1 min-w-0">
          {/* Waveform overlay when actively listening */}
          {isListening && !prompt && (
            <div className="flex items-end gap-[3px] h-6 mb-2" aria-hidden="true">
              {WAVE_DELAYS.map((delay, i) => (
                <div
                  key={i}
                  className="voice-bar"
                  style={{ height: '100%', animationDelay: `${delay}s` }}
                />
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming || isProcessing}
            placeholder={
              isListening    ? 'Listening…'         :
              isProcessing   ? 'Processing speech…' :
              isStreaming    ? 'Generating…'         :
              'Ask anything…'
            }
            rows={1}
            className="w-full bg-transparent resize-none outline-none text-[14px] leading-[1.6] disabled:cursor-not-allowed"
            style={{
              color:     '#ffffff',
              maxHeight: `${MAX_TEXTAREA_HEIGHT}px`,
              overflow:  'auto',
              minHeight: '24px',
              opacity:   (isStreaming || isProcessing) ? 0.4 : 1,
            }}
            aria-label="Message input"
            aria-live={isListening ? 'polite' : undefined}
          />
        </div>

        {/* Mic button */}
        <div className="relative flex-shrink-0">
          {/* Pulse rings when listening */}
          {isListening && (
            <>
              <span
                className="absolute inset-0 rounded-full mic-ring"
                style={{ background: 'rgba(239,68,68,0.18)' }}
                aria-hidden="true"
              />
              <span
                className="absolute inset-0 rounded-full mic-ring-delay"
                style={{ background: 'rgba(239,68,68,0.10)' }}
                aria-hidden="true"
              />
            </>
          )}

          <button
            onClick={handleMicClick}
            disabled={!isSpeechSupported || isStreaming || isProcessing}
            title={
              !isSpeechSupported
                ? 'Voice input not supported in this browser'
                : isListening
                ? 'Stop listening'
                : 'Start voice input'
            }
            className="relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-25 disabled:cursor-not-allowed"
            style={{
              background: isListening
                ? 'rgba(239,68,68,0.85)'
                : 'rgba(255,255,255,0.07)',
              border: `1px solid ${isListening ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`,
            }}
            aria-label={isListening ? 'Stop listening' : 'Start voice input'}
            aria-pressed={isListening}
          >
            {isListening ? (
              <MicOff className="w-3.5 h-3.5 text-white" />
            ) : (
              <Mic
                className="w-3.5 h-3.5"
                style={{ color: isSpeechSupported ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.25)' }}
              />
            )}
          </button>
        </div>

        {/* Send / Stop button */}
        <button
          onClick={isStreaming ? cancelStream : handleSubmit}
          disabled={!isStreaming && !canSubmit}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 disabled:cursor-not-allowed"
          style={{
            background: isStreaming ? 'rgba(255,255,255,0.1)' : canSubmit ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.07)',
            opacity:    isStreaming || canSubmit ? 1 : 0.35,
            transform:  isStreaming || canSubmit ? 'scale(1)' : 'scale(0.88)',
            border:     isStreaming ? '1px solid rgba(255,255,255,0.3)' : 'none',
          }}
          aria-label={isStreaming ? "Stop generation" : "Send message"}
        >
          {isStreaming ? (
            <Square className="w-3 h-3 fill-current text-white/80" />
          ) : (
            <Send
              className="w-3.5 h-3.5"
              style={{ color: canSubmit ? '#000' : 'rgba(255,255,255,0.5)', marginLeft: '1px' }}
            />
          )}
        </button>
      </div>

      {/* Status line */}
      <p
        className="text-center text-[10px] font-mono select-none"
        style={{ color: 'rgba(255,255,255,0.16)' }}
      >
        {isListening   ? `● Listening  ${fmt(elapsedSeconds)}  · tap mic to stop` :
         isProcessing  ? '◌ Processing speech…'                                    :
         !isSpeechSupported ? 'Enter to send · voice input not available in this browser' :
         'Enter to send · Shift+Enter for newline · mic for voice'}
      </p>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <>
      <MetricsPanel
        metrics={metrics}
        cumulativeTokens={cumulativeTokens + metrics.tokenCount}
        isVisible={isInChatMode}
      />

      <AnimatePresence mode="wait">

        {/* ── LANDING MODE ─────────────────────────────── */}
        {!isInChatMode ? (
          <motion.div
            key="landing"
            exit={{ opacity: 0, y: -14, filter: 'blur(4px)' }}
            transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-[780px] mx-auto"
          >
            {PillComposer}
          </motion.div>

        ) : (

          /* ── CHAT MODE ───────────────────────────────── */
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            {/* Fixed-height scroll container — shifts right by sidebarWidth */}
            <div
              ref={scrollContainerRef}
              style={{
                position:   'fixed',
                top:        `${HEADER_HEIGHT}px`,
                left:       sidebarWidth,
                right:      0,
                bottom:     0,
                overflowY:  'auto',
                overflowX:  'hidden',
                zIndex:     10,
                transition: 'left 0.26s cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              <div className="w-full max-w-[960px] mx-auto px-5 sm:px-8 pt-6 pb-[240px] space-y-8">
                {messages.map(msg => (
                  <ChatBubble
                    key={msg.id}
                    message={msg}
                    isStreamingActive={msg.id === streamingMsgId && isStreaming}
                    streamingContent={msg.id === streamingMsgId ? (content || partialContent) : undefined}
                    onCopySuccess={onCopySuccess}
                  />
                ))}
                <div ref={bottomRef} className="h-1" aria-hidden="true" />
              </div>
            </div>

            {/* Fixed composer — shifts right with sidebar */}
            <motion.div
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position:   'fixed',
                bottom:     0,
                left:       sidebarWidth,
                right:      0,
                zIndex:     20,
                padding:    '24px 0 20px',
                background: 'linear-gradient(to top, rgba(0,0,0,1) 60%, rgba(0,0,0,0))',
                transition: 'left 0.26s cubic-bezier(0.4,0,0.2,1)',
                pointerEvents: 'none',
              }}
            >
              <div className="max-w-[960px] mx-auto px-5 sm:px-8" style={{ pointerEvents: 'auto' }}>
                {PillComposer}
              </div>
            </motion.div>

            {/* Chat Navigation Buttons */}
            <AnimatePresence>
              {messages.length >= 4 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="fixed bottom-[120px] right-4 sm:right-8 flex flex-col gap-2 z-30"
                >
                  <button
                    onClick={() => {
                      const el = scrollContainerRef.current;
                      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-all backdrop-blur-md"
                    aria-label="Scroll to top"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => scrollToBottom('smooth')}
                    className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-all backdrop-blur-md"
                    aria-label="Scroll to bottom"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
