// ============================================================
// components/sidebar/ChatSidebar.tsx
// ChatGPT-style left history sidebar
// ============================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, MessageSquare, SquarePen } from 'lucide-react';
import { clsx } from 'clsx';
import { relTime } from '../../hooks/useConversations';
import type { Conversation } from '../../types';

interface ChatSidebarProps {
  open: boolean;
  convs: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
  onClose?: () => void; // mobile: close after selecting
}

const SIDEBAR_WIDTH = 260;

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  open,
  convs,
  activeId,
  onSelect,
  onDelete,
  onNewChat,
  onClose,
}) => {
  const handleSelect = (id: string) => {
    onSelect(id);
    onClose?.(); // collapse on mobile after selection
  };

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="sm:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <div
        style={{
          position:   'fixed',
          top:        '64px',
          left:       0,
          bottom:     0,
          width:      'min(260px, calc(100vw - 28px))',
          zIndex:     50,
          transform:  open ? 'translateX(0)' : `translateX(-${SIDEBAR_WIDTH}px)`,
          transition: 'transform 0.26s cubic-bezier(0.4, 0, 0.2, 1)',
          background: '#080808',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          display:    'flex',
          flexDirection: 'column',
          overflow:   'hidden',
        }}
        aria-label="Chat history"
        role="navigation"
      >
        {/* Top: New Chat button */}
        <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 group"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
            aria-label="Start a new chat"
          >
            <SquarePen
              className="w-3.5 h-3.5 flex-shrink-0 transition-transform group-hover:scale-105"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            />
            <span
              className="text-[13px] font-medium"
              style={{ color: 'rgba(255,255,255,0.70)' }}
            >
              New Chat
            </span>
          </button>
        </div>

        {/* Section label */}
        <div style={{ padding: '10px 16px 6px' }}>
          <span
            className="text-[10px] tracking-[0.16em] uppercase font-mono"
            style={{ color: 'rgba(255,255,255,0.22)' }}
          >
            Recent
          </span>
        </div>

        {/* Conversation list */}
        <div
          style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 8px 16px' }}
        >
          <AnimatePresence initial={false}>
            {convs.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-2 py-10"
              >
                <MessageSquare className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.15)' }} />
                <p
                  className="text-[12px] text-center"
                  style={{ color: 'rgba(255,255,255,0.22)' }}
                >
                  No conversations yet
                </p>
              </motion.div>
            ) : (
              convs.map(conv => {
                const isActive = conv.id === activeId;
                return (
                  <motion.div
                    key={conv.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    style={{ marginBottom: '2px' }}
                  >
                    <div
                      className={clsx(
                        'group relative flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150',
                        isActive
                          ? 'bg-white/[0.08] border border-white/[0.10]'
                          : 'hover:bg-white/[0.045] border border-transparent'
                      )}
                      onClick={() => handleSelect(conv.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && handleSelect(conv.id)}
                      aria-label={`Open conversation: ${conv.title}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {/* Text content */}
                      <div className="flex-1 min-w-0 pr-5">
                        <p
                          className="text-[13px] font-medium leading-tight truncate"
                          style={{ color: isActive ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.72)' }}
                        >
                          {conv.title}
                        </p>
                        <p
                          className="text-[10px] font-mono mt-0.5"
                          style={{ color: 'rgba(255,255,255,0.28)' }}
                        >
                          {relTime(conv.updatedAt)}
                        </p>
                      </div>

                      {/* Delete button — appears on hover or focus */}
                      <button
                        onClick={e => { e.stopPropagation(); onDelete(conv.id); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 focus-visible:opacity-100 transition-all duration-150 hover:bg-red-500/15"
                        style={{ color: 'rgba(255,255,255,0.30)' }}
                        aria-label={`Delete conversation: ${conv.title}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <p
            className="text-[10px] font-mono text-center"
            style={{ color: 'rgba(255,255,255,0.18)' }}
          >
            {convs.length} conversation{convs.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </>
  );
};

export { SIDEBAR_WIDTH };
