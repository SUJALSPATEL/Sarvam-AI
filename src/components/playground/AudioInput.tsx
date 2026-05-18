// ============================================================
// components/playground/AudioInput.tsx
// Real MediaRecorder voice input + file upload
// Premium cinematic recording experience
// ============================================================

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Mic, MicOff, Square, X, FileAudio, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { formatFileSize } from '../../utils/formatters';
import type { AudioFile } from '../../types';

interface AudioInputProps {
  audioFile: AudioFile | null;
  onFileChange: (file: AudioFile | null) => void;
  onAutoSubmit?: () => void;   // fired automatically after recording stops
  disabled?: boolean;
}

const SUPPORTED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.webm', '.flac', '.m4a'];
const SUPPORTED_FORMATS = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/flac', 'audio/m4a'];

// ── Format mm:ss ──────────────────────────────────────────────
const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export const AudioInput: React.FC<AudioInputProps> = ({
  audioFile,
  onFileChange,
  onAutoSubmit,
  disabled,
}) => {
  const [isDragging, setIsDragging]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration]       = useState(0);
  const [micPermission, setMicPermission] = useState<'unknown'|'granted'|'denied'>('unknown');

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const mediaRecRef     = useRef<MediaRecorder | null>(null);
  const chunksRef       = useRef<BlobPart[]>([]);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => () => {
    timerRef.current && clearInterval(timerRef.current);
    mediaRecRef.current?.state === 'recording' && mediaRecRef.current.stop();
  }, []);

  // ── File upload processing ────────────────────────────────────
  const processFile = useCallback((file: File) => {
    setError(null);
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    const isValid = SUPPORTED_FORMATS.includes(file.type) || SUPPORTED_EXTENSIONS.includes(ext);
    if (!isValid) { setError(`Unsupported format. Accepted: ${SUPPORTED_EXTENSIONS.join(', ')}`); return; }
    if (file.size > 25 * 1024 * 1024) { setError('File too large — max 25 MB.'); return; }
    onFileChange({ file, url: URL.createObjectURL(file), name: file.name, size: file.size });
  }, [onFileChange]);

  const handleDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0]; if (f) processFile(f);
  }, [disabled, processFile]);
  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); if (!disabled) setIsDragging(true); }, [disabled]);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '';
  };
  const handleRemove = () => {
    if (audioFile?.url) URL.revokeObjectURL(audioFile.url);
    onFileChange(null); setError(null);
  };

  // ── MediaRecorder recording ───────────────────────────────────
  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission('granted');

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecRef.current = recorder;
      chunksRef.current   = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      recorder.onstop = () => {
        // Stop all mic tracks to release the mic
        stream.getTracks().forEach(t => t.stop());

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const ext  = recorder.mimeType?.includes('ogg') ? '.ogg' : '.webm';
        const file = new File([blob], `recording${ext}`, { type: blob.type });
        const url  = URL.createObjectURL(blob);
        onFileChange({ file, url, name: file.name, size: blob.size });

        // Auto-submit — called after file is ready
        setTimeout(() => onAutoSubmit?.(), 80);

        setIsRecording(false);
        setDuration(0);
        timerRef.current && clearInterval(timerRef.current);
      };

      recorder.start(250); // collect chunks every 250ms
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

    } catch (err: unknown) {
      setMicPermission('denied');
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes('Permission denied') || msg.includes('NotAllowed')
        ? 'Microphone access denied. Please allow access and try again.'
        : 'Could not access microphone.');
    }
  }, [onFileChange, onAutoSubmit]);

  const stopRecording = useCallback(() => {
    if (mediaRecRef.current?.state === 'recording') {
      mediaRecRef.current.stop();
    }
    timerRef.current && clearInterval(timerRef.current);
  }, []);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_EXTENSIONS.join(',')}
        onChange={handleFileInput}
        className="sr-only"
        id="audio-file-input"
        aria-label="Upload audio file"
        disabled={disabled}
      />

      <AnimatePresence mode="wait">
        {/* ── STATE: Has recorded/uploaded audio ── */}
        {audioFile ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-xl border border-white/10 bg-white/[0.025] space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center flex-shrink-0">
                <FileAudio className="w-4 h-4 text-white/55" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/90 truncate">{audioFile.name}</p>
                <p className="text-[11px] text-white/38 font-mono">{formatFileSize(audioFile.size)}</p>
              </div>
              <button
                onClick={handleRemove}
                disabled={disabled}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/8 text-white/35 hover:text-white/65 transition-all"
                aria-label="Remove audio"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <audio controls src={audioFile.url} className="w-full h-8 opacity-70" aria-label="Audio preview" />
          </motion.div>

        ) : isRecording ? (
          /* ── STATE: Recording in progress ── */
          <motion.div
            key="recording"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="flex flex-col items-center justify-center gap-5 py-8 px-5 rounded-xl border border-red-500/20 bg-red-500/[0.03]"
          >
            {/* Pulsing mic */}
            <div className="relative">
              {/* Outer rings */}
              <motion.div
                className="absolute inset-0 rounded-full border border-red-400/25"
                animate={{ scale: [1, 1.55, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border border-red-400/15"
                animate={{ scale: [1, 1.9, 1], opacity: [0.35, 0, 0.35] }}
                transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity, delay: 0.3 }}
              />
              {/* Mic button */}
              <button
                onClick={stopRecording}
                className="relative w-14 h-14 rounded-full bg-red-500/20 border border-red-400/35 flex items-center justify-center hover:bg-red-500/30 transition-all group"
                aria-label="Stop recording"
              >
                <Square className="w-5 h-5 text-red-300 fill-red-300 group-hover:scale-110 transition-transform" />
              </button>
            </div>

            {/* Waveform bars */}
            <div className="flex items-center gap-0.5 h-6" aria-hidden="true">
              {Array.from({ length: 24 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-0.5 rounded-full bg-red-400/55"
                  animate={{ height: ['4px', `${6 + Math.random() * 14}px`, '4px'] }}
                  transition={{
                    duration: 0.55 + Math.random() * 0.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.045,
                  }}
                />
              ))}
            </div>

            {/* Timer + label */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[13px] font-mono text-white/70 tracking-wider">
                  {formatDuration(duration)}
                </span>
              </div>
              <p className="text-[11px] text-white/35">
                Tap the square to stop recording
              </p>
            </div>
          </motion.div>

        ) : (
          /* ── STATE: Idle — record or upload ── */
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2.5"
          >
            {/* Record button — primary CTA */}
            <button
              onClick={startRecording}
              disabled={disabled}
              className={clsx(
                'w-full flex items-center justify-center gap-3 py-4 rounded-xl border transition-all duration-200',
                'hover:bg-white/[0.03] group',
                micPermission === 'denied'
                  ? 'border-red-500/25 opacity-50 cursor-not-allowed'
                  : 'border-white/10 hover:border-white/18',
                disabled && 'opacity-40 cursor-not-allowed'
              )}
              aria-label="Start recording"
            >
              <div className="w-8 h-8 rounded-full border border-white/14 bg-white/5 flex items-center justify-center group-hover:bg-white/8 transition-all">
                <Mic className="w-3.5 h-3.5 text-white/65 group-hover:text-white/85" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[13px] font-medium text-white/78">Start recording</span>
                <span className="text-[10px] text-white/32 font-mono">Tap to capture audio</span>
              </div>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/6" />
              <span className="text-[10px] text-white/25 font-mono tracking-widest uppercase">or</span>
              <div className="flex-1 h-px bg-white/6" />
            </div>

            {/* Drop zone — secondary */}
            <label
              htmlFor="audio-file-input"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={clsx(
                'flex flex-col items-center gap-2 py-5 rounded-xl border border-dashed cursor-pointer transition-all duration-200',
                isDragging
                  ? 'border-white/20 bg-white/[0.025]'
                  : 'border-white/8 hover:border-white/14 hover:bg-white/[0.015]',
                disabled && 'opacity-35 pointer-events-none'
              )}
            >
              <Upload className={clsx('w-4 h-4 transition-colors', isDragging ? 'text-white/55' : 'text-white/22')} />
              <span className="text-[12px] text-white/42">
                {isDragging ? 'Drop file' : 'Upload audio file'}
              </span>
              <span className="text-[10px] text-white/22 font-mono">
                {SUPPORTED_EXTENSIONS.join(' · ')} · max 25 MB
              </span>
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-[11px] text-red-400/80 font-mono"
            role="alert"
          >
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
