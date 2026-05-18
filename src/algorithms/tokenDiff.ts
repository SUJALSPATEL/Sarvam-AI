// ============================================================
// algorithms/tokenDiff.ts — Semantic Token-Level Diff Algorithm
//
// Algorithm: LCS-based word diff with semantic significance filter.
//
// Key improvements over naive diff:
//   - Tokenizes by WORDS only (no whitespace tokens)
//   - Stop-words, articles, prepositions → always render as unchanged
//   - Short/punctuation tokens → always render as unchanged
//   - Only true content-word differences are highlighted
//
// Time Complexity:  O(m × n) where m = words in A, n = words in B
// Space Complexity: O(m × n) for the DP table
// ============================================================

import type { DiffToken, DiffResult } from '../types';

// ── Stop-word list ───────────────────────────────────────────
// These are grammatical/functional words. If they differ between
// models, we still show them as "unchanged" — they don't carry
// meaningful ideational differences.
const STOP_WORDS = new Set([
  // Articles
  'a', 'an', 'the',
  // Conjunctions
  'and', 'or', 'but', 'nor', 'so', 'yet', 'for',
  // Prepositions
  'in', 'on', 'at', 'to', 'of', 'with', 'by', 'from', 'up',
  'about', 'into', 'through', 'between', 'before', 'after',
  'above', 'below', 'during', 'without', 'within', 'along',
  'across', 'behind', 'beyond', 'per', 'via', 'versus',
  // Auxiliary verbs
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might',
  'shall', 'can', 'must', 'ought',
  // Pronouns
  'i', 'we', 'you', 'he', 'she', 'they', 'it',
  'me', 'us', 'him', 'her', 'them', 'my', 'our',
  'your', 'his', 'its', 'their', 'this', 'that',
  'these', 'those', 'who', 'whom', 'which', 'what',
  // Adverbs / quantifiers
  'not', 'also', 'just', 'very', 'more', 'most',
  'some', 'any', 'all', 'both', 'each', 'few', 'many',
  'own', 'such', 'than', 'then', 'when', 'where', 'how',
  'here', 'there', 'now', 'only', 'even', 'still', 'already',
  'again', 'never', 'always', 'often', 'well', 'as', 'if',
  'because', 'since', 'although', 'though', 'while', 'however',
  'therefore', 'thus', 'hence', 'whether', 'else',
]);

/**
 * Returns true only if a token carries meaningful ideational content
 * (i.e. should be highlighted when it differs between models).
 */
function isSignificant(token: string): boolean {
  // Strip punctuation to get the bare word
  const bare = token.toLowerCase().replace(/[^a-z0-9]/g, '');
  // Skip pure punctuation, numbers-only, or very short function words
  if (bare.length <= 2) return false;
  // Skip stop words
  if (STOP_WORDS.has(bare)) return false;
  return true;
}

// ── Tokenizer ────────────────────────────────────────────────
/**
 * Tokenize text into an array of non-whitespace word tokens.
 * Whitespace is NOT included as a token — we add spaces at render time.
 */
export function tokenize(text: string): string[] {
  if (!text.trim()) return [];
  return text.match(/\S+/g) ?? [];
}

// ── LCS table ────────────────────────────────────────────────
function buildLCSTable(tokensA: string[], tokensB: string[]): number[][] {
  const m = tokensA.length;
  const n = tokensB.length;
  const table: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (tokensA[i - 1] === tokensB[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }
  return table;
}

// ── LCS backtrack ────────────────────────────────────────────
function backtrackLCS(
  table: number[][],
  tokensA: string[],
  tokensB: string[]
): { diffA: DiffToken[]; diffB: DiffToken[] } {
  const diffA: DiffToken[] = [];
  const diffB: DiffToken[] = [];

  let i = tokensA.length;
  let j = tokensB.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && tokensA[i - 1] === tokensB[j - 1]) {
      diffA.unshift({ token: tokensA[i - 1], type: 'unchanged' });
      diffB.unshift({ token: tokensB[j - 1], type: 'unchanged' });
      i--; j--;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      diffB.unshift({ token: tokensB[j - 1], type: 'added' });
      j--;
    } else {
      diffA.unshift({ token: tokensA[i - 1], type: 'removed' });
      i--;
    }
  }

  return { diffA, diffB };
}

// ── Semantic post-processor ───────────────────────────────────
/**
 * Demote any diff'd token that isn't a "significant" content word
 * back to 'unchanged'. This keeps highlighting focused on real
 * ideational differences, not grammar/function word variation.
 */
function applySemanticFilter(tokens: DiffToken[]): DiffToken[] {
  return tokens.map(t => {
    if (t.type === 'unchanged') return t;
    // Only highlight if the word carries real semantic content
    if (!isSignificant(t.token)) {
      return { token: t.token, type: 'unchanged' as const };
    }
    return t;
  });
}

// ── Public API ───────────────────────────────────────────────
/**
 * Compute a semantic token-level diff between two model outputs.
 * Only meaningful content-word differences are marked; stop-words,
 * articles, prepositions, and short function words are treated as
 * unchanged regardless of actual text differences.
 */
export function computeTokenDiff(textA: string, textB: string): DiffResult {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.length === 0 && tokensB.length === 0) {
    return { tokensA: [], tokensB: [] };
  }
  if (tokensA.length === 0) {
    return {
      tokensA: [],
      tokensB: tokensB.map(t => ({ token: t, type: 'added' })),
    };
  }
  if (tokensB.length === 0) {
    return {
      tokensA: tokensA.map(t => ({ token: t, type: 'removed' })),
      tokensB: [],
    };
  }

  const table = buildLCSTable(tokensA, tokensB);
  const { diffA, diffB } = backtrackLCS(table, tokensA, tokensB);

  return {
    tokensA: applySemanticFilter(diffA),
    tokensB: applySemanticFilter(diffB),
  };
}

/**
 * Compute diff statistics for the analytics panel.
 * Counts only truly highlighted (significant) tokens.
 */
export function getDiffStats(result: DiffResult) {
  const addedCount     = result.tokensB.filter(t => t.type === 'added').length;
  const removedCount   = result.tokensA.filter(t => t.type === 'removed').length;
  const unchangedCount = result.tokensA.filter(t => t.type === 'unchanged').length;

  const similarityPct =
    result.tokensA.length + result.tokensB.length > 0
      ? Math.round(
          (unchangedCount * 2 * 100) /
            (result.tokensA.length + result.tokensB.length)
        )
      : 100;

  return { addedCount, removedCount, unchangedCount, similarityPct };
}
