'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { CheckCircle2, Vote, BookOpen } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet';
import { useReviewQueue, useQueueState } from '@/hooks/useReviewQueue';
import { useReviewableDrafts } from '@/hooks/useReviewableDrafts';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ReviewQueue } from './ReviewQueue';
import { ReviewBrief } from './ReviewBrief';
import { ReviewActionZone } from './ReviewActionZone';
import { ProposalNotes } from './ProposalNotes';
import { DecisionJournal } from './DecisionJournal';
import { ReviewFramework } from './ReviewFramework';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { FeatureGate } from '@/components/FeatureGate';
import type { VoteChoice } from '@/lib/voting';
import type { ReviewQueueItem } from '@/lib/workspace/types';
import { PROPOSAL_TYPE_LABELS, type ProposalType } from '@/lib/workspace/types';
import { posthog } from '@/lib/posthog';

interface ReviewWorkspaceProps {
  initialProposalKey?: string;
}

// ---------------------------------------------------------------------------
// Draft Brief — adapted ReviewBrief for pre-submission drafts
// ---------------------------------------------------------------------------

function DraftBrief({ draft }: { draft: ReviewQueueItem }) {
  const typeLabel = PROPOSAL_TYPE_LABELS[draft.proposalType as ProposalType] || draft.proposalType;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-1.5 py-0.5">
            Pre-submission Draft
          </span>
        </div>
        <h2 className="text-lg font-bold text-foreground leading-snug">
          {draft.title || 'Untitled Draft'}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs border rounded px-2 py-0.5 text-muted-foreground border-border">
            {typeLabel}
          </span>
        </div>
      </div>
      {draft.abstract && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-muted-foreground">Abstract</h3>
          <p className="text-sm leading-relaxed">{draft.abstract}</p>
        </div>
      )}
      {draft.aiSummary && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-muted-foreground">Summary</h3>
          <p className="text-sm leading-relaxed">{draft.aiSummary}</p>
        </div>
      )}
    </div>
  );
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
 * Three-column layout on desktop (queue rail + main content + notes sidebar),
 * stacked on mobile with a floating button for the notes sheet.
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
  const [notesSheetOpen, setNotesSheetOpen] = useState(false);

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const selectedItem = items[selectedIndex] ?? null;

  // Convert drafts to queue-compatible items
  const draftItems = useMemo(() => {
    const drafts = draftsData?.drafts ?? [];
    return drafts.map(draftToQueueItem);
  }, [draftsData?.drafts]);
  const selectedDraft = draftItems[draftSelectedIndex] ?? null;

  // Track page view
  useEffect(() => {
    posthog.capture('review_workspace_viewed', { voter_role: voterRole });
  }, [voterRole]);

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
    // Count items that already have existingVote from the API
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

  // Keyboard shortcuts (vote buttons handled by ReviewActionZone, but nav here)
  useKeyboardShortcuts({
    onNext: goNext,
    onPrev: goPrev,
  });

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
        <div className="hidden lg:block w-80 border-l border-border shrink-0">
          <div className="p-3 space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
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

  // No voter ID (not a DRep/SPO) -- must check before empty state
  // because when voterId is null, the query is disabled and items will be empty
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

  // Use a stable userId for notes/journal (voterId is the DRep/SPO id)
  const userId = voterId;

  // The current active item depends on which tab is active
  const currentItem = activeTab === 'drafts' ? selectedDraft : selectedItem;

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0">
      {/* Queue rail */}
      <div className="md:w-72 md:shrink-0 md:border-r border-b md:border-b-0 border-border">
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
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'active' && selectedItem && (
          <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-4">
            <ReviewBrief item={selectedItem} allItems={items} />

            <ReviewActionZone
              item={selectedItem}
              drepId={voterId}
              onVote={(_txHash, _index, vote) => handleVoteSuccess(vote as VoteChoice)}
              onNextProposal={goNext}
              totalProposals={progress.total}
              votedCount={progress.reviewed}
            />
          </div>
        )}
        {activeTab === 'drafts' && selectedDraft && (
          <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-4">
            <DraftBrief draft={selectedDraft} />
          </div>
        )}
      </div>

      {/* Desktop: Notes, Journal & Framework sidebar */}
      {currentItem && (
        <div className="hidden lg:block w-80 shrink-0 border-l border-border overflow-y-auto">
          <div className="p-3 space-y-3">
            <ProposalNotes
              proposalTxHash={currentItem.txHash}
              proposalIndex={currentItem.proposalIndex}
              userId={userId}
            />
            <DecisionJournal
              proposalTxHash={currentItem.txHash}
              proposalIndex={currentItem.proposalIndex}
              userId={userId}
            />
            <FeatureGate flag="review_framework_templates">
              <ReviewFramework
                proposalTxHash={currentItem.txHash}
                proposalIndex={currentItem.proposalIndex}
                proposalType={currentItem.proposalType}
              />
            </FeatureGate>
          </div>
        </div>
      )}

      {/* Mobile: Floating button + Sheet for notes/journal/framework */}
      {currentItem && (
        <>
          <div className="lg:hidden fixed bottom-20 right-4 z-40">
            <Button
              variant="default"
              size="icon"
              className="h-12 w-12 rounded-full shadow-lg"
              onClick={() => setNotesSheetOpen(true)}
              aria-label="Open notes and journal"
            >
              <BookOpen className="h-5 w-5" />
            </Button>
          </div>

          <Sheet open={notesSheetOpen} onOpenChange={setNotesSheetOpen}>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Notes & Journal</SheetTitle>
                <SheetDescription>
                  Private notes and deliberation journal for this proposal
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-3 px-4 pb-4">
                <ProposalNotes
                  proposalTxHash={currentItem.txHash}
                  proposalIndex={currentItem.proposalIndex}
                  userId={userId}
                />
                <DecisionJournal
                  proposalTxHash={currentItem.txHash}
                  proposalIndex={currentItem.proposalIndex}
                  userId={userId}
                />
                <FeatureGate flag="review_framework_templates">
                  <ReviewFramework
                    proposalTxHash={currentItem.txHash}
                    proposalIndex={currentItem.proposalIndex}
                    proposalType={currentItem.proposalType}
                  />
                </FeatureGate>
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
