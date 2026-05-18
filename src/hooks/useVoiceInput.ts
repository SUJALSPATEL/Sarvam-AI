// ============================================================
// hooks/useVoiceInput.ts
// Web Speech API — real-time transcription hook
//
// Flow:
//   startListening() → SpeechRecognition starts
//   onLiveTranscript() fires on every word (interim + final)
//   recognition ends → onFinalTranscript() fires → caller submits
//
// Browser support:
//   Chrome, Edge, Safari 14.5+ (webkitSpeechRecognition)
//   Firefox: unsupported → isSupported = false → fallback shown
// ============================================================

import { useState, useRef, useCallback, useEffect } from 'react';

export type VoiceState =
  | 'idle'
  | 'listening'
  | 'processing'   // brief state between stop and submit
  | 'error'
  | 'unsupported';

interface UseVoiceInputOptions {
  /** Called on every interim/final token — use to update the textarea live */
  onLiveTranscript: (text: string) => void;
  /** Called once when recognition fully ends — use to auto-submit */
  onFinalTranscript: (text: string) => void;
  /** BCP 47 language tag, e.g. 'en-US', 'hi-IN' */
  lang?: string;
}

interface UseVoiceInputReturn {
  voiceState: VoiceState;
  isSupported: boolean;
  elapsedSeconds: number;
  startListening: () => void;
  stopListening: () => void;
}

const SpeechRecognitionClass: any =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export function useVoiceInput({
  onLiveTranscript,
  onFinalTranscript,
  lang = 'en-US',
}: UseVoiceInputOptions): UseVoiceInputReturn {
  const [voiceState, setVoiceState]       = useState<VoiceState>(
    SpeechRecognitionClass ? 'idle' : 'unsupported'
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const recognitionRef = useRef<any>(null);
  const finalTextRef   = useRef('');
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep callbacks as refs so they don't cause stale closure issues
  const onLiveRef  = useRef(onLiveTranscript);
  const onFinalRef = useRef(onFinalTranscript);
  useEffect(() => { onLiveRef.current  = onLiveTranscript; }, [onLiveTranscript]);
  useEffect(() => { onFinalRef.current = onFinalTranscript; }, [onFinalTranscript]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setElapsedSeconds(0);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    clearTimer();
  }, [clearTimer]);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionClass) { setVoiceState('unsupported'); return; }

    // Abort any running instance
    if (recognitionRef.current) { recognitionRef.current.abort(); recognitionRef.current = null; }

    finalTextRef.current = '';
    setElapsedSeconds(0);

    const recognition = new SpeechRecognitionClass();
    recognition.continuous     = true;   // keep listening until stopListening()
    recognition.interimResults = true;   // get words as they come
    recognition.lang           = lang;
    recognitionRef.current     = recognition;

    recognition.onstart = () => {
      setVoiceState('listening');
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTextRef.current += t + ' ';
        } else {
          interim += t;
        }
      }
      // Live: final words + current interim word(s)
      onLiveRef.current((finalTextRef.current + interim).trimStart());
    };

    recognition.onend = () => {
      clearTimer();
      const final = finalTextRef.current.trim();
      setVoiceState('processing');

      if (final) {
        // Ensure React has flushed the live transcript into prompt state
        // before we trigger auto-submit
        setTimeout(() => {
          onFinalRef.current(final);
          setVoiceState('idle');
        }, 180);
      } else {
        setTimeout(() => setVoiceState('idle'), 300);
      }
    };

    recognition.onerror = (event: any) => {
      clearTimer();
      if (event.error === 'aborted' || event.error === 'no-speech') {
        setVoiceState('idle');
      } else if (event.error === 'not-allowed') {
        setVoiceState('error');
        setTimeout(() => setVoiceState('idle'), 3000);
      } else {
        setVoiceState('error');
        setTimeout(() => setVoiceState('idle'), 2000);
      }
    };

    try {
      recognition.start();
    } catch {
      setVoiceState('idle');
    }
  }, [lang, clearTimer]);

  // Cleanup on unmount
  useEffect(() => () => {
    recognitionRef.current?.abort();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return {
    voiceState,
    isSupported: SpeechRecognitionClass !== null,
    elapsedSeconds,
    startListening,
    stopListening,
  };
}
