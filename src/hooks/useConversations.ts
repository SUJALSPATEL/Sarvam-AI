// ============================================================
// hooks/useConversations.ts
// localStorage conversation persistence + CRUD
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import type { Conversation, ChatMessage } from '../types';

const STORAGE_KEY = 'sarvam:convs';

const cid = () => `c_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

// Auto-title: first 6 words of first user message
export const autoTitle = (msgs: ChatMessage[]): string => {
  const first = msgs.find(m => m.role === 'user');
  if (!first) return 'New Chat';
  const clean = first.content.replace(/^\[.*?\]\s*/, '').trim();
  const words = clean.split(/\s+/).slice(0, 6);
  const t = words.join(' ');
  return t.length > 46 ? t.slice(0, 43) + '…' : t || 'New Chat';
};

// Relative time label
export const relTime = (ts: number): string => {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
};

// Demo seed for first-ever load
const DEMO: Conversation = {
  id: 'demo_conv_v1',
  title: 'What makes Sarvam AI different',
  messages: [
    {
      id: 'd_u1', role: 'user',
      content: 'What makes Sarvam AI different from other AI models?',
      timestamp: Date.now() - 7_200_000,
    },
    {
      id: 'd_a1', role: 'assistant',
      content:
        'Sarvam AI is purpose-built for Indian languages and cultural contexts. Unlike generic large language models, it is optimised for code-switching, regional dialects, and domain-specific knowledge — making it significantly more accurate for Indic language tasks, speech recognition, and translation workflows.',
      timestamp: Date.now() - 7_195_000,
      status: 'complete',
    },
    {
      id: 'd_u2', role: 'user',
      content: 'Does it support real-time streaming?',
      timestamp: Date.now() - 7_100_000,
    },
    {
      id: 'd_a2', role: 'assistant',
      content:
        'Yes — this playground streams tokens directly from the model as they are generated, using the Fetch ReadableStream API. You can watch responses appear word-by-word with live latency and tokens-per-second metrics in the floating panel.',
      timestamp: Date.now() - 7_095_000,
      status: 'complete',
    },
  ],
  createdAt: Date.now() - 7_200_000,
  updatedAt: Date.now() - 7_095_000,
};

function loadConvs(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Conversation[];
      if (Array.isArray(p) && p.length > 0) return p;
    }
  } catch { /* ignore */ }
  return [DEMO];
}

function persistConvs(convs: Conversation[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(convs)); } catch { /* ignore */ }
}

export interface UseConversationsReturn {
  convs: Conversation[];
  activeId: string | null;
  active: Conversation | null;
  create: () => string;
  save: (id: string, messages: ChatMessage[]) => void;
  remove: (id: string) => void;
  select: (id: string) => void;
}

export function useConversations(): UseConversationsReturn {
  const [convs, setConvs]   = useState<Conversation[]>(loadConvs);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Persist on every change
  useEffect(() => { persistConvs(convs); }, [convs]);

  const active = convs.find(c => c.id === activeId) ?? null;

  const create = useCallback((): string => {
    const id = cid(); const now = Date.now();
    const c: Conversation = { id, title: 'New Chat', messages: [], createdAt: now, updatedAt: now };
    setConvs(p => [c, ...p]);
    setActiveId(id);
    return id;
  }, []);

  const save = useCallback((id: string, messages: ChatMessage[]) => {
    setConvs(p => p.map(c =>
      c.id !== id ? c : {
        ...c,
        title: c.title === 'New Chat' ? autoTitle(messages) : c.title,
        messages,
        updatedAt: Date.now(),
      }
    ));
  }, []);

  const remove = useCallback((id: string) => {
    setConvs(p => p.filter(c => c.id !== id));
    setActiveId(p => (p === id ? null : p));
  }, []);

  const select = useCallback((id: string) => setActiveId(id), []);

  return { convs, activeId, active, create, save, remove, select };
}
