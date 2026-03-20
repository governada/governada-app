'use client';

import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { useFocusableList } from '@/hooks/useFocusableList';
import { useColumnJumpShortcuts } from '@/hooks/useColumnJumpShortcuts';
import { useFocusStore } from '@/lib/workspace/focus';
import { commandRegistry } from '@/lib/workspace/commands';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  FileEdit,
  MessageSquare,
  Globe,
  Archive,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { DraftCard } from './DraftCard';
import { DraftTableRow } from './DraftTableRow';
import type { ProposalDraft, DraftStatus } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PortfolioViewProps {
  drafts: ProposalDraft[];
  isLoading: boolean;
  showArchived: boolean;
}

interface DraftGroups {
  drafts: ProposalDraft[];
  inReview: ProposalDraft[];
  onChain: ProposalDraft[];
  archived: ProposalDraft[];
}

type ColumnType = 'drafts' | 'inReview' | 'onChain' | 'archived';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REVIEW_STATUSES: DraftStatus[] = ['community_review', 'response_revision', 'final_comment'];

const COLUMN_META: Record<
  ColumnType,
  { label: string; icon: typeof FileEdit; emptyTitle: string; emptyDescription: string }
> = {
  drafts: {
    label: 'Drafts',
    icon: FileEdit,
    emptyTitle: 'No drafts',
    emptyDescription: 'Start a new proposal or use AI scaffolding to generate a draft.',
  },
  inReview: {
    label: 'In Review',
    icon: MessageSquare,
    emptyTitle: 'No proposals in review',
    emptyDescription:
      'When a draft is ready, open it for structured community feedback and constitutional review.',
  },
  onChain: {
    label: 'On-Chain',
    icon: Globe,
    emptyTitle: 'No submitted proposals',
    emptyDescription: 'Proposals that pass community review can be submitted on-chain for voting.',
  },
  archived: {
    label: 'Archived',
    icon: Archive,
    emptyTitle: 'No archived proposals',
    emptyDescription: 'Archived proposals will appear here.',
  },
};

// ---------------------------------------------------------------------------
// Group logic
// ---------------------------------------------------------------------------

function groupDrafts(drafts: ProposalDraft[], showArchived: boolean): DraftGroups {
  const groups: DraftGroups = {
    drafts: [],
    inReview: [],
    onChain: [],
    archived: [],
  };

  for (const draft of drafts) {
    if (draft.status === 'draft') {
      groups.drafts.push(draft);
    } else if (REVIEW_STATUSES.includes(draft.status)) {
      groups.inReview.push(draft);
    } else if (draft.status === 'submitted') {
      groups.onChain.push(draft);
    } else if (draft.status === 'archived' && showArchived) {
      groups.archived.push(draft);
    }
  }

  return groups;
}

/** Flatten groups into a single list for keyboard navigation order */
function flattenGroups(groups: DraftGroups): ProposalDraft[] {
  return [...groups.drafts, ...groups.inReview, ...groups.onChain, ...groups.archived];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PortfolioView({ drafts, isLoading, showArchived }: PortfolioViewProps) {
  const authorFilter = useWorkspaceStore((s) => s.authorFilter);
  const authorViewMode = useWorkspaceStore((s) => s.authorViewMode);

  // Filter by search term
  const filteredDrafts = useMemo(() => {
    if (!authorFilter.trim()) return drafts;
    const term = authorFilter.toLowerCase();
    return drafts.filter(
      (d) =>
        (d.title || '').toLowerCase().includes(term) ||
        (d.abstract || '').toLowerCase().includes(term),
    );
  }, [drafts, authorFilter]);

  // Group by status
  const groups = useMemo(
    () => groupDrafts(filteredDrafts, showArchived),
    [filteredDrafts, showArchived],
  );

  // Flat list for keyboard navigation
  const flatList = useMemo(() => flattenGroups(groups), [groups]);

  // Focus management
  const { activeIndex, getListProps, getItemProps } = useFocusableList(
    'drafts-list',
    flatList.length,
  );

  // Compute a flat offset for each group to properly index items
  const groupOffsets = useMemo(
    () => ({
      drafts: 0,
      inReview: groups.drafts.length,
      onChain: groups.drafts.length + groups.inReview.length,
      archived: groups.drafts.length + groups.inReview.length + groups.onChain.length,
    }),
    [groups.drafts.length, groups.inReview.length, groups.onChain.length],
  );

  // Column jump shortcuts (1/2/3/4)
  const columnNames = useMemo(() => {
    const cols: string[] = ['drafts', 'inReview', 'onChain'];
    if (showArchived && groups.archived.length > 0) cols.push('archived');
    return cols;
  }, [showArchived, groups.archived.length]);
  useColumnJumpShortcuts('drafts-list', columnNames, groupOffsets);

  // Scroll the active card into view when navigating with J/K
  useEffect(() => {
    if (activeIndex < 0) return;
    const el = document.querySelector('[data-focus-active="true"]');
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeIndex]);

  // Register Enter command to open the focused draft
  const router = useRouter();
  const flatListRef = useRef(flatList);
  useEffect(() => {
    flatListRef.current = flatList;
  }, [flatList]);

  const openFocusedDraft = useCallback(() => {
    const { activeIndex: idx, activeListId } = useFocusStore.getState();
    if (activeListId !== 'drafts-list') return;
    const draft = flatListRef.current[idx];
    if (draft) {
      const path =
        draft.proposalType === 'NewConstitution'
          ? `/workspace/amendment/${draft.id}`
          : `/workspace/author/${draft.id}`;
      router.push(path);
    }
  }, [router]);

  useEffect(() => {
    const unregister = commandRegistry.register({
      id: 'action.open-draft',
      label: 'Open Draft',
      shortcut: 'enter',
      section: 'actions',
      when: () => useFocusStore.getState().activeListId === 'drafts-list',
      execute: openFocusedDraft,
    });
    return unregister;
  }, [openFocusedDraft]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 'var(--workspace-gap)' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-start justify-between">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-8" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state (no drafts at all)
  if (drafts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground font-medium">No proposals yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm">
            Create your first governance proposal. Choose from Treasury Withdrawals, Info Actions,
            Parameter Changes, or Constitutional Amendments.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Search returned no results
  if (authorFilter.trim() && filteredDrafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <FileText className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          No results for &ldquo;{authorFilter.trim()}&rdquo;
        </p>
        <button
          onClick={() => useWorkspaceStore.getState().setAuthorFilter('')}
          className="text-xs text-[var(--compass-teal)] hover:underline"
        >
          Clear search
        </button>
      </div>
    );
  }

  const listProps = getListProps();

  if (authorViewMode === 'kanban') {
    // Build column list — include archived only if showArchived and there are items
    const columns: ColumnType[] = ['drafts', 'inReview', 'onChain'];
    if (showArchived && groups.archived.length > 0) {
      columns.push('archived');
    }

    return (
      <div {...listProps}>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${columns.length}, 1fr)`,
          }}
        >
          {columns.map((col) => (
            <KanbanColumn
              key={col}
              column={col}
              drafts={groups[col]}
              flatOffset={groupOffsets[col]}
              getItemProps={getItemProps}
            />
          ))}
        </div>
      </div>
    );
  }

  // List mode — Linear-style stacked rows grouped by status
  const listColumns: ColumnType[] = ['drafts', 'inReview', 'onChain'];
  if (showArchived && groups.archived.length > 0) {
    listColumns.push('archived');
  }

  return (
    <div className="space-y-1" {...listProps}>
      {listColumns.map((col) => (
        <TableGroup
          key={col}
          column={col}
          drafts={groups[col]}
          flatOffset={groupOffsets[col]}
          getItemProps={getItemProps}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kanban Column
// ---------------------------------------------------------------------------

interface KanbanColumnProps {
  column: ColumnType;
  drafts: ProposalDraft[];
  flatOffset: number;
  getItemProps: (index: number) => Record<string, unknown>;
}

function KanbanColumn({ column, drafts, flatOffset, getItemProps }: KanbanColumnProps) {
  const meta = COLUMN_META[column];
  const Icon = meta.icon;

  return (
    <div className="flex flex-col min-w-0" data-column={column}>
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground">{meta.label}</h3>
        <Badge variant="secondary" className="text-xs tabular-nums">
          {drafts.length}
        </Badge>
      </div>

      {/* Column content */}
      <div
        className="flex flex-col overflow-y-auto max-h-[calc(100vh-300px)] pr-1"
        style={{ gap: 'var(--workspace-gap)' }}
      >
        {drafts.length === 0 ? (
          <EmptyColumnState title={meta.emptyTitle} description={meta.emptyDescription} />
        ) : (
          drafts.map((draft, i) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              index={i}
              column={column}
              itemProps={getItemProps(flatOffset + i)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table Group (Linear-style stacked rows with collapsible header)
// ---------------------------------------------------------------------------

interface TableGroupProps {
  column: ColumnType;
  drafts: ProposalDraft[];
  flatOffset: number;
  getItemProps: (index: number) => Record<string, unknown>;
}

function TableGroup({ column, drafts, flatOffset, getItemProps }: TableGroupProps) {
  const meta = COLUMN_META[column];
  const Icon = meta.icon;
  const [expanded, setExpanded] = useState(true);

  return (
    <div data-column={column}>
      {/* Group header — clickable to collapse */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-2 w-full px-1 py-1.5 text-left hover:bg-accent/30 rounded transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">{meta.label}</span>
        <Badge variant="secondary" className="text-xs tabular-nums">
          {drafts.length}
        </Badge>
      </button>

      {/* Rows */}
      {expanded && (
        <div className="border border-border/50 rounded-md overflow-hidden">
          {drafts.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground/60">
              {meta.emptyDescription}
            </div>
          ) : (
            drafts.map((draft, i) => (
              <DraftTableRow
                key={draft.id}
                draft={draft}
                column={column}
                itemProps={getItemProps(flatOffset + i)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyColumnState({ title, description }: { title: string; description: string }) {
  return (
    <div className="border border-dashed border-border rounded-lg p-6 text-center">
      <FileText className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground font-medium">{title}</p>
      <p className="text-xs text-muted-foreground/60 mt-1">{description}</p>
    </div>
  );
}
