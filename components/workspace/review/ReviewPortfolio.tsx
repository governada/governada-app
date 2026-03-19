'use client';

import { useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet';
import { useReviewQueue } from '@/hooks/useReviewQueue';
import { useReviewableDrafts } from '@/hooks/useReviewableDrafts';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { useFocusableList } from '@/hooks/useFocusableList';
import { useFocusStore } from '@/lib/workspace/focus';
import { commandRegistry } from '@/lib/workspace/commands';
import { PortfolioSearch } from '@/components/workspace/shared/PortfolioSearch';
import { ReviewCard } from './ReviewCard';
import type { ReviewCardVariant } from './ReviewCard';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Vote, FileText, CheckCircle2, MessageSquare } from 'lucide-react';
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

  const needsVote = useMemo(() => queueItems.filter((item) => !item.existingVote), [queueItems]);

  const completedProposals = useMemo(
    () => queueItems.filter((item) => !!item.existingVote),
    [queueItems],
  );

  // Community drafts needing feedback
  const feedbackDrafts = useMemo(() => draftsData?.drafts ?? [], [draftsData?.drafts]);

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
  const groupOffsets = {
    feedback: 0,
    voting: filteredGroups.feedback.length,
    completed: filteredGroups.feedback.length + filteredGroups.voting.length,
  };

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
        <div className="space-y-6" {...listProps}>
          <ListGroup
            column="feedback"
            drafts={filteredGroups.feedback}
            flatOffset={groupOffsets.feedback}
            getItemProps={getItemProps}
          />
          <ListGroup
            column="voting"
            proposals={filteredGroups.voting}
            flatOffset={groupOffsets.voting}
            getItemProps={getItemProps}
          />
          <ListGroup
            column="completed"
            proposals={filteredGroups.completed}
            flatOffset={groupOffsets.completed}
            getItemProps={getItemProps}
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
    <div className="flex flex-col min-w-0">
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
// List Group
// ---------------------------------------------------------------------------

interface ListGroupProps {
  column: ReviewColumnType;
  drafts?: ProposalDraft[];
  proposals?: ReviewQueueItem[];
  flatOffset: number;
  getItemProps: (index: number) => Record<string, unknown>;
}

function ListGroup({ column, drafts, proposals, flatOffset, getItemProps }: ListGroupProps) {
  const meta = COLUMN_META[column];
  const count = (drafts?.length ?? 0) + (proposals?.length ?? 0);
  const Icon = meta.icon;

  return (
    <div>
      {/* Group header */}
      <div className="flex items-center gap-2 mb-3 border-b border-border pb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground">{meta.label}</h3>
        <Badge variant="secondary" className="text-xs tabular-nums">
          {count}
        </Badge>
      </div>

      {/* Group content */}
      {count === 0 ? (
        <EmptyColumnState title={meta.emptyTitle} description={meta.emptyDescription} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 'var(--workspace-gap)' }}>
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
