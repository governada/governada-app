'use client';

/**
 * ConstitutionTOC — Table of contents sidebar for the constitution editor.
 *
 * Renders a floating sidebar (desktop) or horizontal scroll (mobile) showing
 * all constitution sections with article number badges, amendment status dots,
 * and click-to-navigate functionality.
 *
 * Groups sections by: preamble/defined-terms at top, then articles, then appendices.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ConstitutionNode } from '@/lib/constitution/fullText';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConstitutionTOCProps {
  nodes: ConstitutionNode[];
  amendedIds: Set<string>;
  activeSection?: string;
  onNavigate: (sectionId: string) => void;
}

// ---------------------------------------------------------------------------
// Group nodes by category
// ---------------------------------------------------------------------------

interface GroupedSection {
  label: string;
  nodes: ConstitutionNode[];
}

function groupNodes(nodes: ConstitutionNode[]): GroupedSection[] {
  const preamble: ConstitutionNode[] = [];
  const articles: ConstitutionNode[] = [];
  const appendices: ConstitutionNode[] = [];

  for (const node of nodes) {
    if (node.articleNumber === null) {
      // Preamble, defined terms, or appendix-like content
      if (node.id.startsWith('appendix')) {
        appendices.push(node);
      } else {
        preamble.push(node);
      }
    } else {
      articles.push(node);
    }
  }

  const groups: GroupedSection[] = [];
  if (preamble.length > 0) groups.push({ label: 'Preamble', nodes: preamble });
  if (articles.length > 0) groups.push({ label: 'Articles', nodes: articles });
  if (appendices.length > 0) groups.push({ label: 'Appendices', nodes: appendices });

  return groups;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConstitutionTOC({
  nodes,
  amendedIds,
  activeSection,
  onNavigate,
}: ConstitutionTOCProps) {
  const groups = useMemo(() => groupNodes(nodes), [nodes]);

  return (
    <>
      {/* Desktop: fixed left sidebar */}
      <nav className="hidden lg:block fixed left-0 top-20 bottom-0 w-56 overflow-y-auto border-r border-border/30 bg-background/80 backdrop-blur-sm z-30 py-4 px-3">
        <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-2 mb-3">
          Constitution
        </h3>
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground/40 font-medium px-2">
              {group.label}
            </span>
            <ul className="mt-1 space-y-0.5">
              {group.nodes.map((node) => (
                <TOCItem
                  key={node.id}
                  node={node}
                  isActive={activeSection === node.id}
                  isAmended={amendedIds.has(node.id)}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Mobile: horizontal scroll strip */}
      <nav className="lg:hidden sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-border/30 px-3 py-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {nodes.map((node) => (
            <button
              key={node.id}
              onClick={() => onNavigate(node.id)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors cursor-pointer',
                activeSection === node.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              {node.articleNumber !== null && (
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-primary/10 text-[9px] font-bold text-primary tabular-nums">
                  {node.articleNumber}
                </span>
              )}
              <span className="truncate max-w-[100px]">{node.title}</span>
              {amendedIds.has(node.id) && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

// ---------------------------------------------------------------------------
// TOC Item (desktop)
// ---------------------------------------------------------------------------

interface TOCItemProps {
  node: ConstitutionNode;
  isActive: boolean;
  isAmended: boolean;
  onNavigate: (sectionId: string) => void;
}

function TOCItem({ node, isActive, isAmended, onNavigate }: TOCItemProps) {
  return (
    <li>
      <button
        onClick={() => onNavigate(node.id)}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer group',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
        )}
      >
        {/* Article number badge */}
        {node.articleNumber !== null ? (
          <span
            className={cn(
              'inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded text-[9px] font-bold tabular-nums flex-shrink-0',
              isActive ? 'bg-primary/20 text-primary' : 'bg-muted/50 text-muted-foreground/70',
            )}
          >
            {node.articleNumber}
          </span>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* Title */}
        <span className="text-[11px] leading-tight truncate flex-1">{node.title}</span>

        {/* Amendment dot */}
        {isAmended && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
      </button>
    </li>
  );
}
