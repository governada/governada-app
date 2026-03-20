'use client';

import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet';
import { useReviewQueue } from '@/hooks/useReviewQueue';
import { useReviewableDrafts } from '@/hooks/useReviewableDrafts';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { useFocusableList } from '@/hooks/useFocusableList';
import { useColumnJumpShortcuts } from '@/hooks/useColumnJumpShortcuts';
import { useFocusStore } from '@/lib/workspace/focus';
import { commandRegistry } from '@/lib/workspace/commands';
import { PortfolioSearch } from '@/components/workspace/shared/PortfolioSearch';
import { PortfolioStats } from '@/components/workspace/shared/PortfolioStats';
import { TriageSummary } from '@/components/workspace/shared/TriageSummary';
import type { TriageInsight } from '@/components/workspace/shared/TriageSummary';
import { ReviewCard } from './ReviewCard';
import { ReviewTableRow } from './ReviewTableRow';
import type { ReviewCardVariant } from './ReviewCard';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Vote,
  FileText,
  CheckCircle2,
  MessageSquare,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { ProposalDraft, ReviewQueueItem } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReviewColumnType = 'feedback' | 'voting' | 'completed';

interface ColumnGroups {
  feedback: ProposalDraft[];
  voting: ReviewQueueItem[];
  completed: ReviewQueueItem[];
}

interface FlatItem {
  variant: ReviewCardVariant;
  draft?: ProposalDraft;
  proposal?: ReviewQueueItem;
}

const COLUMN_META: Record<
  ReviewColumnType,
  { label: string; icon: typeof Vote; emptyTitle: string; emptyDescription: string }
> = {
  feedback: {
    label: 'Needs Feedback',
    icon: MessageSquare,
    emptyTitle: 'No drafts need review',
    emptyDescription: 'Community drafts seeking feedback will appear here.',
  },
  voting: {
    label: 'Needs Your Vote',
    icon: Vote,
    emptyTitle: 'No proposals need your vote',
    emptyDescription: 'On-chain proposals you haven\u2019t voted on will appear here.',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    emptyTitle: 'Nothing completed yet',
    emptyDescription: 'Proposals you\u2019ve reviewed or voted on will appear here.',
  },
};

// ---------------------------------------------------------------------------
// Flatten helper (for keyboard navigation ordering)
// ---------------------------------------------------------------------------

function flattenGroups(groups: ColumnGroups): FlatItem[] {
  const items: FlatItem[] = [];
  for (const draft of groups.feedback) {
    items.push({ variant: 'feedback', draft });
  }
  for (const proposal of groups.voting) {
    items.push({ variant: 'voting', proposal });
  }
  for (const proposal of groups.completed) {
    items.push({ variant: 'completed', proposal });
  }
  return items;
}

// ---------------------------------------------------------------------------
// ReviewPortfolio — main exported component
// ---------------------------------------------------------------------------

export function ReviewPortfolio() {
  const router = useRouter();
  const { segment, drepId, poolId } = useSegment();
  const { ownDRepId } = useWallet();

  // Voter identity
  const voterRole = segment === 'spo' ? 'spo' : 'drep';
  const voterId = segment === 'spo' ? poolId : ownDRepId || drepId;

  // Store state
  const reviewViewMode = useWorkspaceStore((s) => s.reviewViewMode);
  const setReviewViewMode = useWorkspaceStore((s) => s.setReviewViewMode);
  const reviewFilter = useWorkspaceStore((s) => s.reviewFilter);
  const setReviewFilter = useWorkspaceStore((s) => s.setReviewFilter);

  // Data fetching
  const {
    data: queueData,
    isLoading: queueLoading,
    error: queueError,
  } = useReviewQueue(voterId, voterRole);
  const { data: draftsData, isLoading: draftsLoading } = useReviewableDrafts();

  const isLoading = queueLoading || draftsLoading;

  // Split on-chain proposals into needs-vote vs completed
  const queueItems = useMemo(() => queueData?.items ?? [], [queueData?.items]);

  const needsVote = useMemo(
    () =>
      queueItems
        .filter((item) => !item.existingVote)
        .sort((a, b) => {
          // Urgent items (fewer epochs remaining) surface first
          const aEpochs = a.epochsRemaining ?? Infinity;
          const bEpochs = b.epochsRemaining ?? Infinity;
          return aEpochs - bEpochs;
        }),
    [queueItems],
  );

  const completedProposals = useMemo(
    () => queueItems.filter((item) => !!item.existingVote),
    [queueItems],
  );

  // Community drafts needing feedback
  const feedbackDrafts = useMemo(() => draftsData?.drafts ?? [], [draftsData?.drafts]);

  // Count urgent items for stats
  const urgentCount = useMemo(
    () => needsVote.filter((p) => p.epochsRemaining != null && p.epochsRemaining <= 3).length,
    [needsVote],
  );

  const reviewStats = useMemo(
    () => [
      {
        label: 'need your vote',
        value: needsVote.length,
        emphasis: needsVote.length > 0,
      },
      {
        label: 'urgent',
        value: urgentCount,
        emphasis: urgentCount > 0,
        color: urgentCount > 0 ? 'text-red-400' : undefined,
      },
      { label: 'need feedback', value: feedbackDrafts.length },
      { label: 'completed', value: completedProposals.length },
    ],
    [needsVote.length, urgentCount, feedbackDrafts.length, completedProposals.length],
  );

  // Generate triage insights
  const reviewTriageInsights = useMemo((): TriageInsight[] => {
    const insights: TriageInsight[] = [];

    // Urgent proposals
    const urgentItems = needsVote.filter(
      (p) => p.epochsRemaining != null && p.epochsRemaining <= 1,
    );
    if (urgentItems.length > 0) {
      const first = urgentItems[0];
      insights.push({
        text: `"${first.title || 'Untitled'}" expires this epoch — vote now to avoid missing it.`,
        priority: 10,
      });
    } else {
      const soonItems = needsVote.filter(
        (p) => p.epochsRemaining != null && p.epochsRemaining <= 3,
      );
      if (soonItems.length > 0) {
        insights.push({
          text: `${soonItems.length} proposal${soonItems.length > 1 ? 's' : ''} expire${soonItems.length === 1 ? 's' : ''} within 3 epochs.`,
          priority: 8,
        });
      }
    }

    // Treasury proposals needing vote
    const treasuryItems = needsVote.filter(
      (p) => p.withdrawalAmount != null && Number(p.withdrawalAmount) > 0,
    );
    if (treasuryItems.length > 0) {
      const totalAda = treasuryItems.reduce((sum, p) => sum + Number(p.withdrawalAmount ?? 0), 0);
      insights.push({
        text: `${treasuryItems.length} treasury proposal${treasuryItems.length > 1 ? 's' : ''} requesting ₳${totalAda.toLocaleString()} total await${treasuryItems.length === 1 ? 's' : ''} your vote.`,
        priority: 7,
      });
    }

    // Feedback drafts needing attention
    if (feedbackDrafts.length > 0 && insights.length < 2) {
      insights.push({
        text: `${feedbackDrafts.length} community draft${feedbackDrafts.length > 1 ? 's' : ''} seeking your feedback.`,
        priority: 4,
      });
    }

    return insights;
  }, [needsVote, feedbackDrafts]);

  // Apply search filter across all columns
  const filteredGroups = useMemo((): ColumnGroups => {
    const term = reviewFilter.trim().toLowerCase();
    if (!term) {
      return { feedback: feedbackDrafts, voting: needsVote, completed: completedProposals };
    }
    return {
      feedback: feedbackDrafts.filter(
        (d) =>
          (d.title || '').toLowerCase().includes(term) ||
          (d.abstract || '').toLowerCase().includes(term),
      ),
      voting: needsVote.filter(
        (p) =>
          (p.title || '').toLowerCase().includes(term) ||
          (p.abstract || '').toLowerCase().includes(term),
      ),
      completed: completedProposals.filter(
        (p) =>
          (p.title || '').toLowerCase().includes(term) ||
          (p.abstract || '').toLowerCase().includes(term),
      ),
    };
  }, [feedbackDrafts, needsVote, completedProposals, reviewFilter]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => flattenGroups(filteredGroups), [filteredGroups]);

  // Focus management
  const { activeIndex, getListProps, getItemProps } = useFocusableList(
    'review-portfolio-list',
    flatList.length,
  );

  // Scroll active card into view
  useEffect(() => {
    if (activeIndex < 0) return;
    const el = document.querySelector('[data-focus-active="true"]');
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeIndex]);

  // Register Enter command to open focused card
  const flatListRef = useRef(flatList);
  useEffect(() => {
    flatListRef.current = flatList;
  }, [flatList]);

  const openFocusedCard = useCallback(() => {
    const { activeIndex: idx, activeListId } = useFocusStore.getState();
    if (activeListId !== 'review-portfolio-list') return;
    const item = flatListRef.current[idx];
    if (!item) return;

    if (item.variant === 'feedback' && item.draft) {
      router.push(`/workspace/author/${item.draft.id}`);
    } else if (item.proposal) {
      router.push(
        `/workspace/review?proposal=${encodeURIComponent(item.proposal.txHash)}:${item.proposal.proposalIndex}`,
      );
    }
  }, [router]);

  useEffect(() => {
    const unregister = commandRegistry.register({
      id: 'action.open-review-card',
      label: 'Open Card',
      shortcut: 'enter',
      section: 'actions',
      when: () => useFocusStore.getState().activeListId === 'review-portfolio-list',
      execute: openFocusedCard,
    });
    return unregister;
  }, [openFocusedCard]);

  // Register J/K navigation
  useEffect(() => {
    const unregisters: Array<() => void> = [];

    unregisters.push(
      commandRegistry.register({
        id: 'review-portfolio.list-down',
        label: 'Next Item',
        shortcut: 'j',
        section: 'actions',
        when: () => useFocusStore.getState().activeListId === 'review-portfolio-list',
        execute: () => useFocusStore.getState().moveDown(),
      }),
    );

    unregisters.push(
      commandRegistry.register({
        id: 'review-portfolio.list-up',
        label: 'Previous Item',
        shortcut: 'k',
        section: 'actions',
        when: () => useFocusStore.getState().activeListId === 'review-portfolio-list',
        execute: () => useFocusStore.getState().moveUp(),
      }),
    );

    return () => {
      for (const fn of unregisters) fn();
    };
  }, []);

  // Compute flat offsets for each column
  const groupOffsets = useMemo(
    () => ({
      feedback: 0,
      voting: filteredGroups.feedback.length,
      completed: filteredGroups.feedback.length + filteredGroups.voting.length,
    }),
    [filteredGroups.feedback.length, filteredGroups.voting.length],
  );

  // Column jump shortcuts (1/2/3)
  const reviewColumnNames = useMemo(() => ['feedback', 'voting', 'completed'], []);
  useColumnJumpShortcuts('review-portfolio-list', reviewColumnNames, groupOffsets);

  // Loading state
  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <PortfolioHeader />
        <PortfolioSearch
          filter=""
          onFilterChange={() => {}}
          viewMode={reviewViewMode}
          onViewModeChange={setReviewViewMode}
          placeholder="Search proposals..."
        />
        <div className="grid lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-36 w-full rounded-xl" />
              <Skeleton className="h-36 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (queueError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <PortfolioHeader />
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">Failed to load review data</p>
            <p className="text-xs text-muted-foreground/60">{String(queueError)}</p>
          </div>
        </div>
      </div>
    );
  }

  // No voter ID — not connected
  if (!voterId) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <Vote className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-base font-semibold text-foreground">Review Workspace</p>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your wallet as a DRep or SPO to start reviewing proposals.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state — no items at all
  const totalItems = feedbackDrafts.length + needsVote.length + completedProposals.length;
  if (totalItems === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <PortfolioHeader />
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">You&apos;re all caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">
              No proposals need your review or vote right now.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Search returned no results
  const totalFiltered =
    filteredGroups.feedback.length + filteredGroups.voting.length + filteredGroups.completed.length;
  if (reviewFilter.trim() && totalFiltered === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <PortfolioHeader />
        <PortfolioSearch
          filter={reviewFilter}
          onFilterChange={setReviewFilter}
          viewMode={reviewViewMode}
          onViewModeChange={setReviewViewMode}
          placeholder="Search proposals..."
        />
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
          <FileText className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No results for &ldquo;{reviewFilter.trim()}&rdquo;
          </p>
          <button
            onClick={() => setReviewFilter('')}
            className="text-xs text-[var(--compass-teal)] hover:underline"
          >
            Clear search
          </button>
        </div>
      </div>
    );
  }

  const listProps = getListProps();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <PortfolioHeader />

      <PortfolioSearch
        filter={reviewFilter}
        onFilterChange={setReviewFilter}
        viewMode={reviewViewMode}
        onViewModeChange={setReviewViewMode}
        placeholder="Search proposals..."
      />

      <PortfolioStats stats={reviewStats} />

      <TriageSummary insights={reviewTriageInsights} />

      {reviewViewMode === 'kanban' ? (
        <div {...listProps}>
          <div className="grid lg:grid-cols-3 gap-4">
            <KanbanColumn
              column="feedback"
              drafts={filteredGroups.feedback}
              flatOffset={groupOffsets.feedback}
              getItemProps={getItemProps}
            />
            <KanbanColumn
              column="voting"
              proposals={filteredGroups.voting}
              flatOffset={groupOffsets.voting}
              getItemProps={getItemProps}
            />
            <KanbanColumn
              column="completed"
              proposals={filteredGroups.completed}
              flatOffset={groupOffsets.completed}
              getItemProps={getItemProps}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1" {...listProps}>
          <ReviewTableGroup
            column="feedback"
            drafts={filteredGroups.feedback}
            flatOffset={groupOffsets.feedback}
            getItemProps={getItemProps}
          />
          <ReviewTableGroup
            column="voting"
            proposals={filteredGroups.voting}
            flatOffset={groupOffsets.voting}
            getItemProps={getItemProps}
          />
          <ReviewTableGroup
            column="completed"
            proposals={filteredGroups.completed}
            flatOffset={groupOffsets.completed}
            getItemProps={getItemProps}
            defaultCollapsed
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PortfolioHeader
// ---------------------------------------------------------------------------

function PortfolioHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Review Proposals</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Community drafts needing feedback and on-chain proposals awaiting your vote.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kanban Column
// ---------------------------------------------------------------------------

interface KanbanColumnProps {
  column: ReviewColumnType;
  drafts?: ProposalDraft[];
  proposals?: ReviewQueueItem[];
  flatOffset: number;
  getItemProps: (index: number) => Record<string, unknown>;
}

function KanbanColumn({ column, drafts, proposals, flatOffset, getItemProps }: KanbanColumnProps) {
  const meta = COLUMN_META[column];
  const count = (drafts?.length ?? 0) + (proposals?.length ?? 0);
  const Icon = meta.icon;

  return (
    <div className="flex flex-col min-w-0" data-column={column}>
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground">{meta.label}</h3>
        <Badge variant="secondary" className="text-xs tabular-nums">
          {count}
        </Badge>
      </div>

      {/* Column content */}
      <div
        className="flex flex-col overflow-y-auto max-h-[calc(100vh-300px)] pr-1"
        style={{ gap: 'var(--workspace-gap)' }}
      >
        {count === 0 ? (
          <EmptyColumnState title={meta.emptyTitle} description={meta.emptyDescription} />
        ) : (
          <>
            {drafts?.map((draft, i) => (
              <ReviewCard
                key={draft.id}
                variant="feedback"
                draft={draft}
                index={i}
                itemProps={getItemProps(flatOffset + i)}
              />
            ))}
            {proposals?.map((proposal, i) => (
              <ReviewCard
                key={`${proposal.txHash}-${proposal.proposalIndex}`}
                variant={column === 'completed' ? 'completed' : 'voting'}
                proposal={proposal}
                index={i + (drafts?.length ?? 0)}
                itemProps={getItemProps(flatOffset + (drafts?.length ?? 0) + i)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table Group (Linear-style stacked rows with collapsible header)
// ---------------------------------------------------------------------------

interface ReviewTableGroupProps {
  column: ReviewColumnType;
  drafts?: ProposalDraft[];
  proposals?: ReviewQueueItem[];
  flatOffset: number;
  getItemProps: (index: number) => Record<string, unknown>;
  defaultCollapsed?: boolean;
}

function ReviewTableGroup({
  column,
  drafts,
  proposals,
  flatOffset,
  getItemProps,
  defaultCollapsed = false,
}: ReviewTableGroupProps) {
  const meta = COLUMN_META[column];
  const count = (drafts?.length ?? 0) + (proposals?.length ?? 0);
  const Icon = meta.icon;
  const [expanded, setExpanded] = useState(!defaultCollapsed);

  // Don't render empty groups when defaultCollapsed (completed with 0 items)
  if (count === 0 && defaultCollapsed) return null;

  const variant: ReviewCardVariant =
    column === 'completed' ? 'completed' : column === 'voting' ? 'voting' : 'feedback';

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
          {count}
        </Badge>
      </button>

      {/* Rows */}
      {expanded && (
        <div className="border border-border/50 rounded-md overflow-hidden">
          {count === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground/60">
              {meta.emptyDescription}
            </div>
          ) : (
            <>
              {drafts?.map((draft, i) => (
                <ReviewTableRow
                  key={draft.id}
                  variant="feedback"
                  draft={draft}
                  itemProps={getItemProps(flatOffset + i)}
                />
              ))}
              {proposals?.map((proposal, i) => (
                <ReviewTableRow
                  key={`${proposal.txHash}-${proposal.proposalIndex}`}
                  variant={variant}
                  proposal={proposal}
                  itemProps={getItemProps(flatOffset + (drafts?.length ?? 0) + i)}
                />
              ))}
            </>
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
