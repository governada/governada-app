'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, Vote } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet';
import { useReviewQueue, useQueueState } from '@/hooks/useReviewQueue';
import { useReviewableDrafts } from '@/hooks/useReviewableDrafts';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import {
  useRevisionNotifications,
  useMarkNotificationRead,
} from '@/hooks/useRevisionNotifications';
import { trackProposalView } from '@/lib/workspace/engagement';
import { ReviewQueue } from './ReviewQueue';
import { ReviewActionZone } from './ReviewActionZone';
import { WorkspaceEmbed } from '@/components/workspace/editor/WorkspaceEmbed';
import { StatusBar } from '@/components/workspace/layout/StatusBar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FeatureGate } from '@/components/FeatureGate';
import type { VoteChoice } from '@/lib/voting';
import type { ReviewQueueItem } from '@/lib/workspace/types';
import { posthog } from '@/lib/posthog';

interface ReviewWorkspaceProps {
  initialProposalKey?: string;
}

// ---------------------------------------------------------------------------
// Map ProposalDraft to ReviewQueueItem for uniform rendering
// ---------------------------------------------------------------------------

function draftToQueueItem(draft: import('@/lib/workspace/types').ProposalDraft): ReviewQueueItem {
  return {
    txHash: draft.id, // Use draft ID as key
    proposalIndex: 0,
    title: draft.title || 'Untitled Draft',
    abstract: draft.abstract || null,
    aiSummary: null,
    proposalType: draft.proposalType,
    withdrawalAmount: null,
    treasuryTier: null,
    epochsRemaining: null,
    isUrgent: false,
    interBodyVotes: {
      drep: { yes: 0, no: 0, abstain: 0 },
      spo: { yes: 0, no: 0, abstain: 0 },
      cc: { yes: 0, no: 0, abstain: 0 },
    },
    citizenSentiment: null,
    existingVote: null,
    sealedUntil: null,
    motivation: draft.motivation || null,
    rationale: draft.rationale || null,
    references: null,
  };
}

/**
 * ReviewWorkspace — the top-level client component for /workspace/review.
 * Two-column layout: queue rail (left) + Tiptap workspace (right) with
 * agent chat panel replacing the old Notes/Annotations/Journal sidebar.
 *
 * Accepts an optional `initialProposalKey` (format: "txHash:index") to
 * auto-select a proposal on load (used by deep-links from discovery pages).
 */
export function ReviewWorkspace({ initialProposalKey }: ReviewWorkspaceProps = {}) {
  const { segment, drepId, poolId } = useSegment();
  const { ownDRepId } = useWallet();

  // Determine voter identity
  const voterRole = segment === 'spo' ? 'spo' : 'drep';
  const voterId = segment === 'spo' ? poolId : ownDRepId || drepId;

  const { data, isLoading, error } = useReviewQueue(voterId, voterRole);
  const { data: draftsData } = useReviewableDrafts();
  const { getStatus, setStatus, reviewedCount } = useQueueState(voterId);

  const [activeTab, setActiveTab] = useState('active');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [draftSelectedIndex, setDraftSelectedIndex] = useState(0);
  const lastTrackedRef = useRef<string | null>(null);

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const selectedItem = items[selectedIndex] ?? null;

  // Convert drafts to queue-compatible items
  const draftItems = useMemo(() => {
    const drafts = draftsData?.drafts ?? [];
    return drafts.map(draftToQueueItem);
  }, [draftsData?.drafts]);
  const selectedDraft = draftItems[draftSelectedIndex] ?? null;

  // Revision notifications
  const { data: notificationsData } = useRevisionNotifications(!!voterId);
  const markRead = useMarkNotificationRead();
  const unreadCount = notificationsData?.unreadCount ?? 0;
  const notifications = notificationsData?.notifications ?? [];
  const [showNotifications, setShowNotifications] = useState(false);

  // Track page view
  useEffect(() => {
    posthog.capture('review_workspace_viewed', { voter_role: voterRole });
  }, [voterRole]);

  // Track proposal view when selection changes
  useEffect(() => {
    if (!selectedItem) return;
    const key = `${selectedItem.txHash}:${selectedItem.proposalIndex}`;
    if (lastTrackedRef.current === key) return;
    lastTrackedRef.current = key;
    trackProposalView(
      selectedItem.txHash,
      selectedItem.proposalIndex,
      voterId ?? undefined,
      segment,
    );
  }, [selectedItem, voterId, segment]);

  // Auto-select proposal from deep-link (initialProposalKey = "txHash:index")
  useEffect(() => {
    if (!initialProposalKey || items.length === 0) return;
    const [targetTxHash, targetIndexStr] = initialProposalKey.split(':');
    if (!targetTxHash || !targetIndexStr) return;
    const targetIndex = parseInt(targetIndexStr, 10);
    if (isNaN(targetIndex)) return;
    const matchIdx = items.findIndex(
      (item) => item.txHash === targetTxHash && item.proposalIndex === targetIndex,
    );
    if (matchIdx >= 0) {
      setSelectedIndex(matchIdx);
    }
  }, [initialProposalKey, items]);

  // Progress computation
  const progress = useMemo(() => {
    const reviewed = reviewedCount(items);
    const alreadyVoted = items.filter(
      (item) => item.existingVote && getStatus(item.txHash, item.proposalIndex) !== 'voted',
    ).length;
    return { reviewed: reviewed + alreadyVoted, total: items.length };
  }, [items, reviewedCount, getStatus]);

  // Navigation callbacks
  const goNext = useCallback(() => {
    if (activeTab === 'drafts') {
      setDraftSelectedIndex((prev) => Math.min(prev + 1, draftItems.length - 1));
    } else {
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    }
  }, [activeTab, items.length, draftItems.length]);

  const goPrev = useCallback(() => {
    if (activeTab === 'drafts') {
      setDraftSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    }
  }, [activeTab]);

  const handleSelect = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const handleDraftSelect = useCallback((index: number) => {
    setDraftSelectedIndex(index);
  }, []);

  // Vote success handler — called by ReviewActionZone after on-chain vote succeeds
  const handleVoteSuccess = useCallback(
    (vote: VoteChoice) => {
      if (!selectedItem) return;
      setStatus(selectedItem.txHash, selectedItem.proposalIndex, 'voted', vote);
    },
    [selectedItem, setStatus],
  );

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNext: goNext,
    onPrev: goPrev,
  });

  // Derive the agent userRole from segment
  const agentUserRole = segment === 'cc' ? ('cc_member' as const) : ('reviewer' as const);

  // The current active item depends on which tab is active
  const currentItem = activeTab === 'drafts' ? selectedDraft : selectedItem;

  // Deselect to return to queue-only view
  const handleBackToQueue = useCallback(() => {
    if (activeTab === 'drafts') {
      setDraftSelectedIndex(-1);
    } else {
      setSelectedIndex(-1);
    }
  }, [activeTab]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full">
        <div className="hidden md:block w-72 border-r border-border shrink-0">
          <div className="p-3 space-y-3">
            <Skeleton className="h-5 w-full" />
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">Failed to load review queue</p>
          <p className="text-xs text-muted-foreground/60">{String(error)}</p>
        </div>
      </div>
    );
  }

  // No voter ID (not a DRep/SPO)
  if (!voterId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Vote className="mx-auto h-8 w-8 text-muted-foreground" />
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

  // Empty state
  if (items.length === 0 && draftItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">You&apos;re all caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">
              No open proposals need your review right now.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Queue rail content — used inside the fullscreen WorkspaceLayout
  const queueRailContent = (
    <>
      {/* Revision notifications badge */}
      {unreadCount > 0 && (
        <div className="relative px-3 pt-2">
          <button
            onClick={() => setShowNotifications((prev) => !prev)}
            className="flex w-full items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-foreground hover:bg-amber-500/10 transition-colors"
          >
            <Bell className="h-3.5 w-3.5 text-amber-500" />
            <span>
              {unreadCount} revised proposal{unreadCount !== 1 ? 's' : ''}
            </span>
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          </button>
          {showNotifications && notifications.length > 0 && (
            <div className="mt-1 rounded-md border border-border bg-background shadow-lg divide-y divide-border max-h-48 overflow-y-auto">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    markRead.mutate(n.id);
                    const matchIdx = items.findIndex((item) => item.txHash === n.proposalId);
                    if (matchIdx >= 0) {
                      setSelectedIndex(matchIdx);
                    }
                    setShowNotifications(false);
                  }}
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="text-xs font-medium truncate">Proposal v{n.versionNumber}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {n.sectionsChanged.length} section{n.sectionsChanged.length !== 1 ? 's' : ''}{' '}
                    revised &mdash; tap to review
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <FeatureGate
        flag="review_unified_tabs"
        fallback={
          <ReviewQueue
            items={items}
            selectedIndex={selectedIndex}
            onSelect={handleSelect}
            getStatus={getStatus}
            progress={progress}
          />
        }
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-2 pt-2 shrink-0">
            <TabsList className="w-full">
              <TabsTrigger value="active" className="flex-1 text-xs">
                Active Proposals
                {items.length > 0 && (
                  <span className="ml-1 text-[10px] text-muted-foreground">({items.length})</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="drafts" className="flex-1 text-xs">
                Pre-submission
                {draftItems.length > 0 && (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    ({draftItems.length})
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="active" className="flex-1 min-h-0 mt-0">
            <ReviewQueue
              items={items}
              selectedIndex={selectedIndex}
              onSelect={handleSelect}
              getStatus={getStatus}
              progress={progress}
            />
          </TabsContent>
          <TabsContent value="drafts" className="flex-1 min-h-0 mt-0">
            {draftItems.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <p className="text-xs text-muted-foreground">
                  No pre-submission drafts awaiting review.
                </p>
              </div>
            ) : (
              <ReviewQueue
                items={draftItems}
                selectedIndex={draftSelectedIndex}
                onSelect={handleDraftSelect}
                getStatus={() => 'unreviewed'}
                progress={{ reviewed: 0, total: draftItems.length }}
              />
            )}
          </TabsContent>
        </Tabs>
      </FeatureGate>
    </>
  );

  // When a proposal is selected, render the fullscreen workspace overlay
  if (currentItem) {
    const isActiveDraft = activeTab === 'drafts';
    const item = isActiveDraft ? selectedDraft! : selectedItem!;
    const key = isActiveDraft ? `draft:${item.txHash}` : `${item.txHash}:${item.proposalIndex}`;

    return (
      <WorkspaceEmbed
        key={key}
        proposalId={item.txHash}
        content={{
          title: item.title || '',
          abstract: item.abstract || '',
          motivation: item.motivation || '',
          rationale: item.rationale || '',
        }}
        proposalType={item.proposalType}
        userRole={agentUserRole}
        readOnly={true}
        onBack={handleBackToQueue}
        backLabel="Back to queue"
        queueRail={queueRailContent}
        belowEditor={
          !isActiveDraft ? (
            <div className="max-w-3xl mx-auto px-6 pb-6">
              <ReviewActionZone
                item={selectedItem!}
                drepId={voterId}
                onVote={(_txHash, _index, vote) => handleVoteSuccess(vote as VoteChoice)}
                onNextProposal={goNext}
                totalProposals={progress.total}
                votedCount={progress.reviewed}
              />
            </div>
          ) : undefined
        }
        statusBar={
          isActiveDraft ? (
            <StatusBar userStatus="Pre-submission review" />
          ) : (
            <StatusBar
              completeness={{ done: progress.reviewed, total: progress.total }}
              userStatus={`Reviewing ${progress.reviewed}/${progress.total}`}
            />
          )
        }
        showModeSwitch={false}
      />
    );
  }

  // No proposal selected — show the queue as a standalone list view
  return (
    <div className="flex flex-col h-full">
      <div className="max-w-2xl mx-auto w-full flex-1 min-h-0 overflow-y-auto">
        {queueRailContent}
      </div>
    </div>
  );
}
