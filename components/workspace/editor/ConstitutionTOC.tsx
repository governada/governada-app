'use client';

/**
 * ConstitutionTOC — Notion-style table of contents sidebar for the constitution editor.
 *
 * Features:
 * - Collapsible groups (Preamble, Articles, Appendices) with chevron toggles
 * - Active section highlighting and amendment dot indicators
 * - Change count on hover per section
 * - Click to navigate
 */

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConstitutionNode } from '@/lib/constitution/fullText';
import type { AmendmentChange } from '@/lib/constitution/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConstitutionTOCProps {
  nodes: ConstitutionNode[];
  amendedIds: Set<string>;
  activeSection?: string;
  onNavigate: (sectionId: string) => void;
  /** Amendment changes for hover summaries */
  changes?: AmendmentChange[];
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
  changes = [],
}: ConstitutionTOCProps) {
  const groups = useMemo(() => groupNodes(nodes), [nodes]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const changeCountBySection = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of changes) {
      map.set(c.articleId, (map.get(c.articleId) ?? 0) + 1);
    }
    return map;
  }, [changes]);

  const toggleGroup = (label: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  return (
    <>
      {/* Desktop: sidebar panel */}
      <nav className="hidden lg:block w-full h-full overflow-y-auto py-4 px-3">
        <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-2 mb-3">
          Constitution
        </h3>
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.label);
          return (
            <div key={group.label} className="mb-3">
              <button
                onClick={() => toggleGroup(group.label)}
                className="flex items-center gap-1 px-2 py-1 w-full text-left group cursor-pointer"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                )}
                <span className="text-[9px] uppercase tracking-wide text-muted-foreground/50 font-medium group-hover:text-muted-foreground transition-colors">
                  {group.label}
                </span>
                <span className="text-[9px] text-muted-foreground/30 ml-auto tabular-nums">
                  {group.nodes.length}
                </span>
              </button>

              {!isCollapsed && (
                <ul className="mt-0.5 space-y-0.5">
                  {group.nodes.map((node) => (
                    <TOCItem
                      key={node.id}
                      node={node}
                      isActive={activeSection === node.id}
                      isAmended={amendedIds.has(node.id)}
                      changeCount={changeCountBySection.get(node.id)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
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
  changeCount?: number;
  onNavigate: (sectionId: string) => void;
}

function TOCItem({ node, isActive, isAmended, changeCount, onNavigate }: TOCItemProps) {
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
        title={
          changeCount
            ? `${changeCount} change${changeCount !== 1 ? 's' : ''} in this section`
            : undefined
        }
      >
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

        <span className="text-[11px] leading-tight truncate flex-1">{node.title}</span>

        {isAmended && changeCount && changeCount > 0 && (
          <span className="hidden group-hover:inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-amber-500/15 text-[9px] font-medium text-amber-400 tabular-nums">
            {changeCount}
          </span>
        )}

        {isAmended && (
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0',
              changeCount && changeCount > 0 ? 'group-hover:hidden' : '',
            )}
          />
        )}
      </button>
    </li>
  );
}
