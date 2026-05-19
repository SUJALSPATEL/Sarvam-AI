// ============================================================
// App.tsx — Root application component
// Sidebar + conversation management wiring
// ============================================================

import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Terminal, GitCompare, ExternalLink, PanelLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { ChatSection } from './components/playground/ChatSection';
import { DiffViewer } from './components/diff/DiffViewer';
import { ToastContainer } from './components/ui/Toast';
import { TaglineHero } from './components/ui/TaglineHero';
import { ChatSidebar, SIDEBAR_WIDTH } from './components/sidebar/ChatSidebar';
import { useToast } from './hooks/useToast';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useConversations } from './hooks/useConversations';
import type { ChatMessage } from './types';

type Tab = 'playground' | 'diff';

const TAB_CONFIG: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'playground', label: 'Playground', icon: Terminal },
  { id: 'diff',       label: 'Diff Viewer', icon: GitCompare },
];

const AnimatedEarth: React.FC = () => {
  const isHoveredRef = React.useRef(false);
  const rotationRef = React.useRef(0);
  const containerRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    
    const animate = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;
      
      // on hover, rotate faster (1.3x speed as requested)
      const baseSpeed = 0.01; // slightly faster base speed so the 1.3x is noticeable
      const speed = isHoveredRef.current ? baseSpeed * 1.3 : baseSpeed; // degrees per ms
      rotationRef.current = (rotationRef.current + speed * delta) % 360;
      
      if (containerRef.current) {
        containerRef.current.style.transform = `rotate(${rotationRef.current}deg)`;
        containerRef.current.style.opacity = isHoveredRef.current ? "1" : "0.6";
      }
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div 
      className="fixed bottom-0 left-0 z-10 pointer-events-auto cursor-pointer"
      style={{ transform: 'translate(-50%, 50%)' }}
      onMouseEnter={() => { isHoveredRef.current = true; }}
      onMouseLeave={() => { isHoveredRef.current = false; }}
    >
      <img
        ref={containerRef}
        src="/earth.jpg"
        alt="Rotating Earth"
        className="rounded-full transition-opacity duration-700 object-cover"
        style={{ 
          width: '400px', 
          height: '400px',
        }}
      />
    </div>
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useLocalStorage<Tab>('app:activeTab', 'playground');
  const { toasts, addToast, removeToast } = useToast();

  // ── Sidebar ────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-close sidebar when switching to diff viewer
  React.useEffect(() => {
    if (activeTab === 'diff') {
      setSidebarOpen(false);
    }
  }, [activeTab]);

  // ── Conversations ──────────────────────────────────────────
  const { convs, activeId, active, create, save, remove, select } = useConversations();

  // chatActive: controls TaglineHero visibility + main padding
  // Must be EXPLICIT state — set immediately when first prompt is sent,
  // NOT derived from localStorage (which only updates after stream ends).
  const [chatActive, setChatActive] = useState(false);

  // chatKey: the React key on ChatSection.
  // CRITICAL: only changes on explicit New Chat / sidebar switch.
  // Never changes during a live session so ChatSection never remounts mid-stream.
  const [chatKey, setChatKey] = useState('session_init');

  // ── Handlers ───────────────────────────────────────────────
  const handleCopySuccess = useCallback(() => addToast('success', 'Copied to clipboard'), [addToast]);
  const handleError       = useCallback((msg: string) => addToast('error', msg), [addToast]);

  /** Called by ChatSection the instant first prompt is submitted.
   *  Only hides hero — does NOT call create() here, because create() changes
   *  activeId → if chatKey depended on activeId ChatSection would remount
   *  mid-stream, wiping all messages. Conversation created lazily on save. */
  const handleChatStarted = useCallback(() => {
    setChatActive(true); // hides TaglineHero immediately on first Submit
  }, []);

  /** Called by ChatSection when a stream completes — persists to localStorage.
   *  Creates a conversation lazily here (not in handleChatStarted) so chatKey
   *  never changes during an active streaming session. */
  const handleConversationSave = useCallback((messages: ChatMessage[], totalTokens?: number, sessionTokens?: number) => {
    if (activeId) {
      save(activeId, messages, totalTokens, sessionTokens);
    } else {
      // First completed session with no prior activeId — create + save.
      // Both use setState updater fns, so React batches them correctly.
      const id = create();
      save(id, messages, totalTokens, sessionTokens);
      // chatKey intentionally NOT updated here — ChatSection stays mounted.
    }
  }, [activeId, create, save]);

  /** New Chat: remount ChatSection with a fresh key and empty state */
  const handleNewChat = useCallback(() => {
    const id = create();
    setChatKey(`session_${id}`);   // force ChatSection remount for blank state
    setChatActive(false);          // show hero again
    if (window.innerWidth < 640) setSidebarOpen(false);
  }, [create]);

  /** Restore a conversation from sidebar — remount ChatSection with its messages */
  const handleSelectConversation = useCallback((id: string) => {
    select(id);
    setChatKey(`session_${id}`);   // force ChatSection remount with initialMessages
    const conv = convs.find(c => c.id === id);
    setChatActive((conv?.messages.length ?? 0) > 0);
    if (window.innerWidth < 640) setSidebarOpen(false);
  }, [select, convs]);

  /** Delete from sidebar */
  const handleDeleteConversation = useCallback((id: string) => {
    remove(id);
  }, [remove]);

  // Sidebar pixel width to pass to ChatSection (desktop only)
  const chatSidebarWidth = sidebarOpen ? SIDEBAR_WIDTH : 0;
  // On mobile (<640px), sidebar overlays — don't shift chat content
  // We use CSS to handle this: transition only on sm+ screens

  return (
    <div
      className="min-h-screen flex flex-col dark"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] glass-strong">
        <div className="w-full px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-3">

            {/* ── LEFT: Sidebar toggle + brand ── */}
            <div className="flex items-center gap-2 flex-shrink-0">

              {/* Sidebar toggle */}
              {activeTab === 'playground' && (
                <button
                  onClick={() => setSidebarOpen(o => !o)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/6 border border-transparent hover:border-white/10"
                  style={{ color: sidebarOpen ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.40)' }}
                  aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                  aria-expanded={sidebarOpen}
                >
                  <PanelLeft className="w-4.5 h-4.5" />
                </button>
              )}

              {/* SARVAM logo + wordmark */}
              <div className="flex items-center gap-2">
                <img src="/logo.jpg" alt="Sarvam Logo" className="w-6 h-6 rounded-sm object-cover" />
                <span
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize:   '24px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: '#ffffff',
                    lineHeight: 1,
                    userSelect: 'none',
                  }}
                >
                  sarvam
                </span>
              </div>
            </div>

            {/* ── CENTER: Tab switcher ── */}
            <nav
              className="hidden sm:flex items-center gap-0.5 p-1 rounded-xl bg-white/5 border border-white/11"
              role="tablist"
              aria-label="Main navigation"
            >
              {TAB_CONFIG.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`panel-${tab.id}`}
                    id={`tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={clsx(
                      'relative flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium',
                      'transition-all duration-200 cursor-pointer',
                      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25',
                      isActive ? 'text-white' : 'text-white/55 hover:text-white/85'
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute inset-0 bg-white/10 border border-white/12 rounded-lg"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      />
                    )}
                    <span className="relative flex items-center gap-2">
                      <Icon className={clsx('w-4 h-4', isActive ? 'opacity-80' : 'opacity-50')} />
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* ── RIGHT: GitHub + Live ── */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href="https://github.com/SUJALSPATEL/Sarvam-AI"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 flex items-center justify-center rounded-xl text-white/40 hover:text-white/75 hover:bg-white/6 border border-transparent hover:border-white/10 transition-all duration-200"
                aria-label="View on GitHub"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/12 bg-white/4">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                <span className="text-[11px] font-mono tracking-wider font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>LIVE</span>
              </div>
            </div>

          </div>

          {/* Mobile tab bar */}
          <div className="sm:hidden flex gap-1.5 pb-3" role="tablist" aria-label="Navigation mobile">
            {TAB_CONFIG.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive ? 'bg-white/10 text-white border border-white/12' : 'text-white/55 hover:bg-white/6'
                  )}
                >
                  <Icon className="w-4 h-4 opacity-75" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Chat History Sidebar ────────────────────────────── */}
      <ChatSidebar
        open={sidebarOpen}
        convs={convs}
        activeId={activeId}
        onSelect={handleSelectConversation}
        onDelete={handleDeleteConversation}
        onNewChat={handleNewChat}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ── Tagline Hero — playground only, before chat starts ── */}
      {activeTab === 'playground' && !chatActive && <TaglineHero />}

      {/* ── Main content ────────────────────────────────────── */}
      <main className="flex-1 w-full relative grid" style={{ gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }}>

        {/* Animated Quartered Earth */}
        {activeTab === 'playground' && !sidebarOpen && !chatActive && <AnimatedEarth />}

        {/* Playground — always mounted, crossfade */}
        <div
          id="panel-playground"
          role="tabpanel"
          aria-labelledby="tab-playground"
          className={chatActive ? 'w-full h-full' : 'w-full h-full px-5 sm:px-8 py-6'}
          style={{
            gridArea: '1 / 1 / 2 / 2',
            zIndex: activeTab === 'playground' ? 10 : 1,
            pointerEvents: activeTab === 'playground' ? 'auto' : 'none',
            opacity: activeTab === 'playground' ? 1 : 0,
            transform: activeTab === 'playground' ? 'translateX(0) scale(1)' : 'translateX(-30px) scale(0.98)',
            filter: activeTab === 'playground' ? 'blur(0px)' : 'blur(4px)',
            transition: 'all 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          {/*
            key={activeId ?? 'new'} — React remounts ChatSection when switching
            conversations, giving it fresh initialMessages + reset state.
          */}
          <ChatSection
            key={chatKey}
            onCopySuccess={handleCopySuccess}
            onError={handleError}
            onChatStarted={handleChatStarted}
            initialMessages={active?.messages ?? []}
            initialTotalTokens={active?.totalTokens}
            initialSessionTokens={active?.sessionTokens}
            onConversationSave={handleConversationSave}
            sidebarWidth={chatSidebarWidth}
          />
        </div>

        {/* Diff Viewer — always mounted, crossfade */}
        <div
          id="panel-diff"
          role="tabpanel"
          aria-labelledby="tab-diff"
          className="w-full h-full px-5 sm:px-8 py-6"
          style={{
            gridArea: '1 / 1 / 2 / 2',
            zIndex: activeTab === 'diff' ? 10 : 1,
            pointerEvents: activeTab === 'diff' ? 'auto' : 'none',
            opacity: activeTab === 'diff' ? 1 : 0,
            transform: activeTab === 'diff' ? 'translateX(0) scale(1)' : 'translateX(30px) scale(0.98)',
            filter: activeTab === 'diff' ? 'blur(0px)' : 'blur(4px)',
            transition: 'all 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          <DiffViewer />
        </div>

      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)] py-3.5">
        <div className="w-full px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[12px] font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.42)' }}>
            SARVAM.ai — Made with Love
          </p>
          <div className="flex items-center gap-4 text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.30)' }}>
            <a href="mailto:4434sujal@gmail.com" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default App;
