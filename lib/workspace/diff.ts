/**
 * Version Diff Engine — line-by-line diff for proposal draft versions.
 *
 * Implements a simplified Myers diff algorithm (no external deps).
 * Compares text line-by-line and produces added/removed/unchanged segments.
 */

import type { DiffResult, DraftContent, StructuredDiff } from './types';

// ---------------------------------------------------------------------------
// Core line-by-line diff (Myers-style shortest edit script)
// ---------------------------------------------------------------------------

/**
 * Compute a line-by-line diff between two texts.
 * Returns an array of DiffResult segments.
 */
export function computeTextDiff(oldText: string, newText: string): DiffResult[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const editScript = computeEditScript(oldLines, newLines);
  return editScript;
}

/**
 * Compare each field of two DraftContent objects independently.
 */
export function computeStructuredDiff(
  oldContent: DraftContent,
  newContent: DraftContent,
): StructuredDiff {
  const fields: ('title' | 'abstract' | 'motivation' | 'rationale')[] = [
    'title',
    'abstract',
    'motivation',
    'rationale',
  ];
  const fieldsChanged: string[] = [];

  const result: Record<string, DiffResult[]> = {};

  for (const field of fields) {
    const diff = computeTextDiff(oldContent[field] || '', newContent[field] || '');
    result[field] = diff;

    const hasChanges = diff.some((d) => d.type !== 'unchanged');
    if (hasChanges) {
      fieldsChanged.push(field);
    }
  }

  return {
    title: result.title,
    abstract: result.abstract,
    motivation: result.motivation,
    rationale: result.rationale,
    fieldsChanged,
  };
}

// ---------------------------------------------------------------------------
// Myers diff implementation (O((N+M)D) time, O(N+M) space)
// ---------------------------------------------------------------------------

function computeEditScript(oldLines: string[], newLines: string[]): DiffResult[] {
  const N = oldLines.length;
  const M = newLines.length;

  // Handle trivial cases
  if (N === 0 && M === 0) return [];
  if (N === 0) return newLines.map((text) => ({ type: 'added' as const, text }));
  if (M === 0) return oldLines.map((text) => ({ type: 'removed' as const, text }));

  // Compute LCS using dynamic programming (simpler than full Myers for our use case)
  // Then build diff from the LCS
  const lcs = computeLCS(oldLines, newLines);

  const results: DiffResult[] = [];
  let oi = 0;
  let ni = 0;
  let li = 0;

  while (oi < N || ni < M) {
    if (
      li < lcs.length &&
      oi < N &&
      ni < M &&
      oldLines[oi] === lcs[li] &&
      newLines[ni] === lcs[li]
    ) {
      // This line is in the LCS — unchanged
      results.push({ type: 'unchanged', text: oldLines[oi] });
      oi++;
      ni++;
      li++;
    } else {
      // Emit removals from old until we hit the next LCS line
      while (oi < N && (li >= lcs.length || oldLines[oi] !== lcs[li])) {
        results.push({ type: 'removed', text: oldLines[oi] });
        oi++;
      }
      // Emit additions from new until we hit the next LCS line
      while (ni < M && (li >= lcs.length || newLines[ni] !== lcs[li])) {
        results.push({ type: 'added', text: newLines[ni] });
        ni++;
      }
    }
  }

  return results;
}

/**
 * Compute Longest Common Subsequence of two string arrays.
 * Uses standard DP approach — O(N*M) time and space, acceptable for proposal-sized texts.
 */
function computeLCS(a: string[], b: string[]): string[] {
  const N = a.length;
  const M = b.length;

  // For very large texts, fall back to a simple approach
  if (N * M > 1_000_000) {
    return simpleLCS(a, b);
  }

  // Build DP table
  const dp: number[][] = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(0));

  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the LCS
  const result: string[] = [];
  let i = N;
  let j = M;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

/**
 * Simplified LCS for very large texts — uses a greedy matching approach.
 * Less optimal but avoids memory issues for huge documents.
 */
function simpleLCS(a: string[], b: string[]): string[] {
  const bIndex = new Map<string, number[]>();
  for (let j = 0; j < b.length; j++) {
    const line = b[j];
    if (!bIndex.has(line)) bIndex.set(line, []);
    bIndex.get(line)!.push(j);
  }

  const result: string[] = [];
  let lastJ = -1;

  for (let i = 0; i < a.length; i++) {
    const positions = bIndex.get(a[i]);
    if (!positions) continue;

    // Find the smallest position in b that's > lastJ
    for (const pos of positions) {
      if (pos > lastJ) {
        result.push(a[i]);
        lastJ = pos;
        break;
      }
    }
  }

  return result;
}
