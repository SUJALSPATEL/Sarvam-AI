// ============================================================
// types/index.ts — Shared TypeScript types for the entire app
// ============================================================

export type InputMode = 'text' | 'audio';

export type StreamStatus = 'idle' | 'streaming' | 'complete' | 'error' | 'cancelled' | 'network_lost' | 'timeout';

export interface StreamMetrics {
  tokenCount: number;
  tokensPerSecond: number;
  elapsedTime: number; // ms
  status: StreamStatus;
}

export interface StreamState {
  content: string;
  isStreaming: boolean;
  status: StreamStatus;
  error: string | null;
  partialContent: string; // preserved on error
}

export interface DiffToken {
  token: string;
  type: 'added' | 'removed' | 'unchanged';
}

export interface DiffResult {
  tokensA: DiffToken[];
  tokensB: DiffToken[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export interface AudioFile {
  file: File;
  url: string;
  name: string;
  size: number;
  duration?: number;
}

export interface PlaygroundSession {
  prompt: string;
  response: string;
  mode: InputMode;
  timestamp: number;
}

// ── Chat / Conversation types ────────────────────────────────
export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  status?: StreamStatus;  // for assistant messages
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
