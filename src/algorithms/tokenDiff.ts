// ============================================================
// algorithms/tokenDiff.ts — Progressive Token Alignment Diff
//
// Algorithm: Custom streaming-aware local sliding-window alignment
//
// Why this approach?
// - Traditional algorithms like Myers or LCS (DP matrix) are 
//   designed for global sequence alignment and minimal edit scripts 
//   (like Git source code). They are overkill (O(m*n)) and produce
//   less conversationally readable alignments when AI models 
//   frequently shift sentence structures.
// - This algorithm uses a local context window (sliding window) to
//   find the highest-scoring alignment nearby. It favors contextual
//   continuity and is much more stable for real-time streaming,
//   since it processes progressively without heavy global recomputation.
//
// Time Complexity: O(N * W^2) where N is token count and W is window size.
// Space Complexity: O(N) for storing the result.
// ============================================================

import type { DiffToken, DiffResult } from '../types';

/**
 * Tokenize text into an array of non-whitespace tokens.
 * Whitespace is NOT included as a token — spaces are added at render time.
 */
export function tokenize(text: string): string[] {
  if (!text.trim()) return [];
  return text.match(/\S+/g) ?? [];
}

/**
 * Custom similarity scoring system.
 * EXACT MATCH: 1.0
 * CASE-INSENSITIVE MATCH: 0.9
 * PUNCTUATION VARIATION: 0.7
 * PARTIAL STRING SIMILARITY: 0.5
 * NO MATCH: 0
 */
function getTokenSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  if (aLower === bLower) return 0.9;
  
  const aBare = aLower.replace(/[^a-z0-9]/g, '');
  const bBare = bLower.replace(/[^a-z0-9]/g, '');
  
  if (aBare === bBare && aBare.length > 0) return 0.7;
  
  if (aBare.length > 3 && bBare.length > 3) {
    if (aBare.startsWith(bBare) || bBare.startsWith(aBare)) return 0.5;
    if (aBare.includes(bBare) || bBare.includes(aBare)) return 0.4;
  }
  
  return 0.0;
}

/**
 * Progressive Token Alignment Diff
 * Designed specifically for conversational AI outputs, streamed token generation,
 * readable response comparison, and local contextual token shifts.
 */
export function computeTokenDiff(textA: string, textB: string): DiffResult {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  
  const diffA: DiffToken[] = [];
  const diffB: DiffToken[] = [];
  
  let i = 0;
  let j = 0;
  
  const WINDOW_SIZE = 5;
  const MATCH_THRESHOLD = 0.4;
  
  while (i < tokensA.length && j < tokensB.length) {
    let bestScore = -1;
    let bestA = -1;
    let bestB = -1;
    
    // Search in a local window for the best semantic alignment
    for (let wA = 0; wA < WINDOW_SIZE && i + wA < tokensA.length; wA++) {
      for (let wB = 0; wB < WINDOW_SIZE && j + wB < tokensB.length; wB++) {
        const score = getTokenSimilarity(tokensA[i + wA], tokensB[j + wB]);
        // Penalize matches that are further away to prefer closer alignments
        const penalizedScore = score - (wA + wB) * 0.01;
        if (penalizedScore > bestScore && score >= MATCH_THRESHOLD) {
          bestScore = penalizedScore;
          bestA = wA;
          bestB = wB;
        }
      }
    }
    
    if (bestScore >= MATCH_THRESHOLD) {
      // Anything skipped in A is removed
      for (let k = 0; k < bestA; k++) {
        diffA.push({ token: tokensA[i++], type: 'removed' });
      }
      // Anything skipped in B is added
      for (let k = 0; k < bestB; k++) {
        diffB.push({ token: tokensB[j++], type: 'added' });
      }
      
      // The matched tokens
      const rawScore = getTokenSimilarity(tokensA[i], tokensB[j]);
      const matchType = rawScore === 1.0 ? 'unchanged' : 'modified';
      
      diffA.push({ token: tokensA[i++], type: matchType });
      diffB.push({ token: tokensB[j++], type: matchType });
      
    } else {
      // No match found in the window, greedily consume one token from both
      // to keep progressing the stream
      diffA.push({ token: tokensA[i++], type: 'removed' });
      diffB.push({ token: tokensB[j++], type: 'added' });
    }
  }
  
  // Consume remaining
  while (i < tokensA.length) {
    diffA.push({ token: tokensA[i++], type: 'removed' });
  }
  while (j < tokensB.length) {
    diffB.push({ token: tokensB[j++], type: 'added' });
  }
  
  return { tokensA: diffA, tokensB: diffB };
}

/**
 * Compute diff statistics for the analytics panel.
 */
export function getDiffStats(result: DiffResult) {
  const addedCount     = result.tokensB.filter(t => t.type === 'added').length;
  const removedCount   = result.tokensA.filter(t => t.type === 'removed').length;
  const modifiedCountA = result.tokensA.filter(t => t.type === 'modified').length;
  const unchangedCount = result.tokensA.filter(t => t.type === 'unchanged').length;
  
  const similarityPct =
    result.tokensA.length + result.tokensB.length > 0
      ? Math.round(
          ((unchangedCount * 2 + modifiedCountA) * 100) /
            (result.tokensA.length + result.tokensB.length)
        )
      : 100;

  return { addedCount, removedCount, unchangedCount, similarityPct };
}
