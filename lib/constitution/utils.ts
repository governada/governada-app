/**
 * Utility functions for constitutional amendment operations.
 */

import type { ConstitutionNode } from './fullText';
import type { AmendmentChange } from './types';

/**
 * Extract AmendmentChange[] from a draft's type_specific JSONB.
 */
export function extractAmendmentChanges(
  typeSpecific: Record<string, unknown> | null | undefined,
): AmendmentChange[] {
  if (!typeSpecific) return [];
  const changes = typeSpecific.amendmentChanges;
  if (!Array.isArray(changes)) return [];
  return changes as AmendmentChange[];
}

/**
 * Serialize AmendmentChange[] back into type_specific shape for saving.
 */
export function serializeAmendmentChanges(
  existing: Record<string, unknown> | null | undefined,
  changes: AmendmentChange[],
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    amendmentChanges: changes,
  };
}

/** A segment of a diff: unchanged, added, or removed text. */
export interface DiffSegment {
  type: 'unchanged' | 'added' | 'removed';
  text: string;
}

/**
 * Build a diff view for a single constitution section by applying
 * the relevant amendment changes.
 *
 * Returns an array of DiffSegments that can be rendered inline.
 */
export function buildAmendmentDiff(
  nodeId: string,
  originalText: string,
  changes: AmendmentChange[],
): DiffSegment[] {
  const relevant = changes
    .filter((c) => c.articleId === nodeId)
    .sort((a, b) => {
      const idxA = originalText.indexOf(a.originalText);
      const idxB = originalText.indexOf(b.originalText);
      return idxA - idxB;
    });

  if (relevant.length === 0) {
    return [{ type: 'unchanged', text: originalText }];
  }

  const segments: DiffSegment[] = [];
  let cursor = 0;

  for (const change of relevant) {
    const idx = originalText.indexOf(change.originalText, cursor);
    if (idx === -1) continue;

    // Text before this change
    if (idx > cursor) {
      segments.push({ type: 'unchanged', text: originalText.slice(cursor, idx) });
    }

    // The removed text
    segments.push({ type: 'removed', text: change.originalText });

    // The added text
    if (change.proposedText) {
      segments.push({ type: 'added', text: change.proposedText });
    }

    cursor = idx + change.originalText.length;
  }

  // Remaining text after last change
  if (cursor < originalText.length) {
    segments.push({ type: 'unchanged', text: originalText.slice(cursor) });
  }

  return segments;
}

/**
 * Generate a plain-language summary of all amendment changes.
 */
export function generateAmendmentSummary(changes: AmendmentChange[]): string {
  if (changes.length === 0) return 'No changes proposed.';

  const byArticle = new Map<string, AmendmentChange[]>();
  for (const c of changes) {
    const list = byArticle.get(c.articleId) ?? [];
    list.push(c);
    byArticle.set(c.articleId, list);
  }

  const parts: string[] = [];
  for (const [articleId, articleChanges] of byArticle) {
    const count = articleChanges.length;
    parts.push(`${count} change${count > 1 ? 's' : ''} to ${articleId}`);
  }

  return `Proposed amendment: ${parts.join(', ')}. ${changes.length} total change${changes.length > 1 ? 's' : ''}.`;
}

/**
 * Apply accepted amendment changes to produce the proposed constitution text.
 * Returns new ConstitutionNode[] with accepted changes applied.
 */
export function computeConstitutionWithAmendments(
  nodes: ConstitutionNode[],
  changes: AmendmentChange[],
): ConstitutionNode[] {
  const accepted = changes.filter((c) => c.status === 'accepted');

  return nodes.map((node) => {
    const nodeChanges = accepted.filter((c) => c.articleId === node.id);
    if (nodeChanges.length === 0) return node;

    let text = node.text;
    // Apply changes in reverse order to preserve character offsets
    const sorted = [...nodeChanges].sort((a, b) => {
      const idxA = text.indexOf(a.originalText);
      const idxB = text.indexOf(b.originalText);
      return idxB - idxA; // reverse order
    });

    for (const change of sorted) {
      const idx = text.indexOf(change.originalText);
      if (idx !== -1) {
        text =
          text.slice(0, idx) + change.proposedText + text.slice(idx + change.originalText.length);
      }
    }

    return { ...node, text };
  });
}

/**
 * Get the set of article IDs that have been modified by any changes.
 */
export function getAmendedArticleIds(changes: AmendmentChange[]): Set<string> {
  return new Set(changes.map((c) => c.articleId));
}
