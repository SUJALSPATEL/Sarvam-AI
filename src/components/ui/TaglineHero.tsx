// ============================================================
// components/ui/TaglineHero.tsx
// Static random greeting — Sarvam dashboard typography style
// ============================================================

import React, { useState } from 'react';
import { motion } from 'framer-motion';

const TAGLINES = [
  'Hey Superman, Where should we start',
  'Wassup Avenger, What to Continue',
  'Always Ready for You',
  'Thought India, Thought Sarvam',
  'Nothing But Sarvam AI',
  'Sarvam gives you fins',
  'Yeah Thats Sarvam',
];

const pick = () => TAGLINES[Math.floor(Math.random() * TAGLINES.length)];

export const TaglineHero: React.FC = () => {
  const [tagline] = useState<string>(pick);

  return (
    <div className="w-full border-b border-[var(--border)]">
      {/* Full-width — tight vertical, breathing horizontal */}
      <div className="w-full px-5 sm:px-8 pt-8 pb-7 sm:pt-10 sm:pb-8 flex flex-col items-center justify-center gap-2.5">

        {/* Main greeting — Playfair Display serif, editorial style */}
        <motion.h1
          initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="text-center select-none"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(2rem, 4vw, 3.25rem)',
            fontWeight: 500,
            fontStyle: 'normal',
            letterSpacing: '-0.01em',
            lineHeight: 1.18,
            color: '#ffffff',
          }}
          aria-label={tagline}
        >
          {tagline}
        </motion.h1>

        {/* Capability subtext — readable */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.42 }}
          style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', letterSpacing: '0.08em' }}
          className="font-mono"
        >
          Real-time inference&nbsp;·&nbsp;streaming&nbsp;·&nbsp;token diff
        </motion.p>

      </div>
    </div>
  );
};
