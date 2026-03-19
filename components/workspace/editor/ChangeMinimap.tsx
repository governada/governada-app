'use client';

/**
 * ChangeMinimap — VS Code-style vertical strip showing where changes exist in the document.
 *
 * Renders a thin vertical bar in the TOC sidebar with colored dots/bars indicating
 * where amendments have been made. Click to scroll to that section.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { AmendmentChange } from '@/lib/constitution/types';
import type { ConstitutionNode } from '@/lib/constitution/fullText';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChangeMinimapProps {
  nodes: ConstitutionNode[];
  changes: AmendmentChange[];
  activeSection?: string;
  onNavigate: (sectionId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChangeMinimap({ nodes, changes, activeSection, onNavigate }: ChangeMinimapProps) {
  // Group changes by section and count status
  const sectionStats = useMemo(() => {
    const map = new Map<
      string,
      { total: number; pending: number; accepted: number; rejected: number }
    >();
    for (const c of changes) {
      const stats = map.get(c.articleId) ?? { total: 0, pending: 0, accepted: 0, rejected: 0 };
      stats.total++;
      if (c.status === 'pending') stats.pending++;
      else if (c.status === 'accepted') stats.accepted++;
      else if (c.status === 'rejected') stats.rejected++;
      map.set(c.articleId, stats);
    }
    return map;
  }, [changes]);

  if (changes.length === 0) return null;

  return (
    <div className="hidden lg:flex flex-col items-center gap-0.5 py-2 px-1">
      {nodes.map((node) => {
        const stats = sectionStats.get(node.id);
        const isActive = activeSection === node.id;

        if (!stats) {
          // No changes in this section — thin muted line
          return (
            <button
              key={node.id}
              onClick={() => onNavigate(node.id)}
              className="w-1.5 h-2 rounded-full bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
              title={node.title}
            />
          );
        }

        // Determine color based on most significant status
        const color =
          stats.rejected > 0
            ? 'bg-rose-500'
            : stats.pending > 0
              ? 'bg-amber-400'
              : 'bg-emerald-500';

        return (
          <button
            key={node.id}
            onClick={() => onNavigate(node.id)}
            className={cn(
              'w-2 rounded-full transition-all cursor-pointer',
              color,
              isActive ? 'h-4 ring-1 ring-primary/50' : 'h-2.5 hover:h-3',
            )}
            title={`${node.title}: ${stats.total} change${stats.total !== 1 ? 's' : ''}`}
          />
        );
      })}
    </div>
  );
}
