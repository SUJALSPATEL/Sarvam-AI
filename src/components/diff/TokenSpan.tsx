// ============================================================
// components/diff/TokenSpan.tsx — Individual highlighted token
// Tokens are words only (no whitespace tokens).
// A trailing space is added after every word at render time.
// ============================================================

import React from 'react';
import { clsx } from 'clsx';
import type { DiffToken } from '../../types';

interface TokenSpanProps {
  token: DiffToken;
}

export const TokenSpan: React.FC<TokenSpanProps> = ({ token }) => {
  // Pure whitespace tokens should never reach here, but guard anyway
  if (/^\s+$/.test(token.token)) return null;

  return (
    <>
      <span
        className={clsx(
          'transition-colors duration-200',
          token.type === 'added'     && 'token-added',
          token.type === 'removed'   && 'token-removed',
          token.type === 'unchanged' && 'token-unchanged'
        )}
        aria-label={
          token.type !== 'unchanged'
            ? `${token.type === 'added' ? 'Added' : 'Removed'}: ${token.token}`
            : undefined
        }
      >
        {token.token}
      </span>
      {/* Re-introduce natural word spacing since whitespace is not a token */}
      {' '}
    </>
  );
};
