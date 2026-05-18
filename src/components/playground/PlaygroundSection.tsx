// ============================================================
// components/playground/PlaygroundSection.tsx
// Prompt: session state only (no localStorage).
// Audio: auto-submits after recording stops.
// ============================================================

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Trash2 } from 'lucide-react';
import { InputModeToggle } from './InputModeToggle';
import { TextInput } from './TextInput';
import { AudioInput } from './AudioInput';
import { ResponsePanel } from './ResponsePanel';
import { Button } from '../ui/Button';
import { useStreamingResponse } from '../../hooks/useStreamingResponse';
import { useMetrics } from '../../hooks/useMetrics';
import type { InputMode, AudioFile } from '../../types';

interface PlaygroundSectionProps {
  onCopySuccess: () => void;
  onError: (msg: string) => void;
  onComplete: () => void;
}

export const PlaygroundSection: React.FC<PlaygroundSectionProps> = ({
  onCopySuccess,
  onError,
  onComplete,
}) => {
  const [mode, setMode]         = useState<InputMode>('text');
  // ✅ Plain useState — no localStorage persistence. Clears on refresh.
  const [prompt, setPrompt]     = useState('');
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const hasEverSubmitted        = useRef(false);

  const {
    content,
    partialContent,
    isStreaming,
    status,
    error,
    startStream,
    cancelStream,
    clearContent,
    retryStream,
  } = useStreamingResponse();

  const metrics = useMetrics(content, isStreaming, status);

  // ── Core submit ─────────────────────────────────────────────
  const handleSubmit = useCallback(async (overrideAudio?: AudioFile) => {
    const resolvedAudio = overrideAudio ?? audioFile;
    const inputText =
      mode === 'text'
        ? prompt.trim()
        : resolvedAudio
        ? `[Audio recording: ${resolvedAudio.name}] — Please transcribe and analyze this audio input.`
        : '';
    if (!inputText) return;

    hasEverSubmitted.current = true;

    // Clear prompt after submit (ChatGPT behavior)
    if (mode === 'text') setPrompt('');

    try {
      await startStream(inputText);
      if (status === 'complete') onComplete();
    } catch {
      onError('Generation failed. Please try again.');
    }
  }, [mode, prompt, audioFile, startStream, status, onComplete, onError]);

  // ── Auto-submit after recording stops ───────────────────────
  const handleRecordingComplete = useCallback(() => {
    // audioFile state may not be updated yet — AudioInput passes the new file
    // via onFileChange just before calling onAutoSubmit, so we read from
    // the ref in the next microtask via a small closure pattern.
    // Use a flag so we trigger once the state is settled.
    setTimeout(() => {
      setAudioFile(prev => {
        if (prev) {
          handleSubmit(prev);
        }
        return prev;
      });
    }, 100);
  }, [handleSubmit]);

  const handleClear = useCallback(() => {
    clearContent();
    setPrompt('');
    setAudioFile(null);
  }, [clearContent]);

  const canSubmit =
    !isStreaming &&
    (mode === 'text' ? prompt.trim().length > 0 : audioFile !== null);

  const showResponse = hasEverSubmitted.current;

  return (
    <div className="flex flex-col gap-4 w-full max-w-[760px] mx-auto">

      {/* ── Mode toggle ── */}
      <div className="flex justify-end">
        <InputModeToggle mode={mode} onChange={setMode} disabled={isStreaming} />
      </div>

      {/* ── Input card ── */}
      <div className="card-enterprise">

        {/* Header strip */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/7">
          <span
            className="text-[10px] uppercase tracking-[0.22em] font-mono font-medium"
            style={{ color: 'rgba(255,255,255,0.40)' }}
          >
            {mode === 'text' ? 'Prompt' : 'Audio'}
          </span>
          {isStreaming && (
            <span
              className="flex items-center gap-1.5 text-[10px] font-mono"
              style={{ color: 'rgba(255,255,255,0.40)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white/55 animate-pulse" />
              Generating…
            </span>
          )}
        </div>

        {/* Input body */}
        <div className="px-5 pt-3.5 pb-3">
          <AnimatePresence mode="wait">
            {mode === 'text' ? (
              <motion.div
                key="text"
                initial={{ opacity: 0, x: -3 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 3 }}
                transition={{ duration: 0.12 }}
              >
                <TextInput
                  value={prompt}
                  onChange={setPrompt}
                  onSubmit={handleSubmit}
                  disabled={isStreaming}
                />
              </motion.div>
            ) : (
              <motion.div
                key="audio"
                initial={{ opacity: 0, x: 3 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -3 }}
                transition={{ duration: 0.12 }}
              >
                <AudioInput
                  audioFile={audioFile}
                  onFileChange={setAudioFile}
                  onAutoSubmit={handleRecordingComplete}
                  disabled={isStreaming}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action bar */}
        <div
          className="flex items-center justify-between px-5 py-2.5 border-t border-white/7"
          style={{ background: 'rgba(255,255,255,0.012)' }}
        >
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={handleClear}
            disabled={isStreaming}
            aria-label="Clear"
          >
            Clear
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={<Send className="w-3.5 h-3.5" />}
            iconPosition="right"
            loading={isStreaming}
            disabled={!canSubmit}
            onClick={() => handleSubmit()}
            aria-label="Generate"
          >
            {isStreaming ? 'Generating' : 'Generate'}
          </Button>
        </div>
      </div>

      {/* ── Response panel ── */}
      <AnimatePresence>
        {showResponse && (
          <motion.div
            key="response"
            initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <ResponsePanel
              content={content}
              partialContent={partialContent}
              isStreaming={isStreaming}
              status={status}
              error={error}
              metrics={metrics}
              onCancel={cancelStream}
              onRetry={retryStream}
              onCopySuccess={onCopySuccess}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
