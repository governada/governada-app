/**
 * Word-level diff for the inline improve popover.
 *
 * Uses LCS (Longest Common Subsequence) on word tokens to produce
 * a readable diff showing added, removed, and unchanged words.
 */

export interface WordDiffSegment {
  type: 'unchanged' | 'added' | 'removed';
  text: string;
}

/**
 * Compute a word-level diff between two strings.
 * Returns segments of unchanged, added, and removed words.
 */
export function computeWordDiff(oldText: string, newText: string): WordDiffSegment[] {
  if (oldText === newText) return [{ type: 'unchanged', text: oldText }];
  if (!oldText) return [{ type: 'added', text: newText }];
  if (!newText) return [{ type: 'removed', text: oldText }];

  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);

  // Build LCS table
  const m = oldWords.length;
  const n = newWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff segments
  const rawSegments: WordDiffSegment[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      rawSegments.unshift({ type: 'unchanged', text: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawSegments.unshift({ type: 'added', text: newWords[j - 1] });
      j--;
    } else {
      rawSegments.unshift({ type: 'removed', text: oldWords[i - 1] });
      i--;
    }
  }

  // Merge consecutive segments of the same type
  const merged: WordDiffSegment[] = [];
  for (const seg of rawSegments) {
    const last = merged[merged.length - 1];
    if (last && last.type === seg.type) {
      last.text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}
