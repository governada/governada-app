'use client';

/**
 * DiffView — Read-only view showing the full constitution with all amendments
 * highlighted inline (green insertions, red strikethrough deletions).
 *
 * Toggle via a header action button or Cmd+K command.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { CONSTITUTION_NODES } from '@/lib/constitution/fullText';
import type { AmendmentChange } from '@/lib/constitution/types';
import type { ConstitutionNode } from '@/lib/constitution/fullText';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DiffViewProps {
  changes: AmendmentChange[];
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DiffSegment {
  type: 'unchanged' | 'removed' | 'added';
  text: string;
}

/** Build diff segments for a section's text given its changes */
function buildSectionDiff(
  node: ConstitutionNode,
  sectionChanges: AmendmentChange[],
): DiffSegment[] {
  if (sectionChanges.length === 0) {
    return [{ type: 'unchanged', text: node.text }];
  }

  const segments: DiffSegment[] = [];
  let remaining = node.text;

  // Sort changes by position in text (earliest first)
  const sorted = [...sectionChanges].sort((a, b) => {
    const posA = remaining.indexOf(a.originalText);
    const posB = remaining.indexOf(b.originalText);
    return posA - posB;
  });

  for (const change of sorted) {
    if (change.status === 'rejected') continue; // Skip rejected changes

    const idx = remaining.indexOf(change.originalText);
    if (idx === -1) continue; // Original text not found

    // Text before the change
    if (idx > 0) {
      segments.push({ type: 'unchanged', text: remaining.slice(0, idx) });
    }

    // The removed text
    segments.push({ type: 'removed', text: change.originalText });

    // The added text
    if (change.proposedText) {
      segments.push({ type: 'added', text: change.proposedText });
    }

    remaining = remaining.slice(idx + change.originalText.length);
  }

  // Remaining text after all changes
  if (remaining) {
    segments.push({ type: 'unchanged', text: remaining });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DiffView({ changes, onClose }: DiffViewProps) {
  // Group changes by article
  const changesByArticle = useMemo(() => {
    const map = new Map<string, AmendmentChange[]>();
    for (const c of changes) {
      const list = map.get(c.articleId) ?? [];
      list.push(c);
      map.set(c.articleId, list);
    }
    return map;
  }, [changes]);

  const totalChanges = changes.filter((c) => c.status !== 'rejected').length;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">Amendment Diff View</h2>
          <span className="text-xs text-muted-foreground">
            {totalChanges} change{totalChanges !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted/50 transition-colors cursor-pointer"
        >
          Close Diff View
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
          {CONSTITUTION_NODES.map((node) => {
            const sectionChanges = changesByArticle.get(node.id) ?? [];
            const hasChanges = sectionChanges.filter((c) => c.status !== 'rejected').length > 0;
            const segments = buildSectionDiff(node, sectionChanges);

            return (
              <section key={node.id} className="space-y-2">
                {/* Section header */}
                <div className="flex items-center gap-2">
                  {node.articleNumber !== null && (
                    <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded bg-primary/10 text-[10px] font-bold text-primary tabular-nums">
                      {node.articleNumber}
                    </span>
                  )}
                  <h3
                    className={cn(
                      'text-xs font-semibold uppercase tracking-wide',
                      hasChanges ? 'text-foreground' : 'text-muted-foreground/60',
                    )}
                  >
                    {node.title}
                  </h3>
                  {hasChanges && (
                    <span className="text-[9px] text-amber-400 font-medium">
                      {sectionChanges.filter((c) => c.status !== 'rejected').length} change
                      {sectionChanges.filter((c) => c.status !== 'rejected').length !== 1
                        ? 's'
                        : ''}
                    </span>
                  )}
                </div>

                {/* Diff content */}
                <div
                  className={cn(
                    'text-sm leading-relaxed whitespace-pre-wrap',
                    !hasChanges && 'text-muted-foreground/50',
                  )}
                >
                  {segments.map((seg, i) => {
                    if (seg.type === 'removed') {
                      return (
                        <span
                          key={i}
                          className="line-through text-rose-400/80 bg-rose-500/10 px-0.5 rounded"
                        >
                          {seg.text}
                        </span>
                      );
                    }
                    if (seg.type === 'added') {
                      return (
                        <span
                          key={i}
                          className="text-emerald-400/80 bg-emerald-500/10 px-0.5 rounded"
                        >
                          {seg.text}
                        </span>
                      );
                    }
                    return <span key={i}>{seg.text}</span>;
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 px-6 py-2 border-t border-border/50 text-[10px] text-muted-foreground/60 shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded bg-rose-500/20" />
          Removed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded bg-emerald-500/20" />
          Added
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded bg-muted/30" />
          Unchanged
        </span>
      </div>
    </div>
  );
}
