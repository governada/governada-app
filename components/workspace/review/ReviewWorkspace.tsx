'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { CheckCircle2, Vote, BookOpen } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet';
import { useReviewQueue, useQueueState } from '@/hooks/useReviewQueue';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ReviewQueue } from './ReviewQueue';
import { ReviewBrief } from './ReviewBrief';
import { ReviewActionZone } from './ReviewActionZone';
import { PostVoteShare } from './PostVoteShare';
import { ProposalNotes } from './ProposalNotes';
import { DecisionJournal } from './DecisionJournal';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { VoteChoice } from '@/lib/voting';
import { posthog } from '@/lib/posthog';

/**
 * ReviewWorkspace — the top-level client component for /workspace/review.
 * Three-column layout on desktop (queue rail + main content + notes sidebar),
 * stacked on mobile with a floating button for the notes sheet.
 */
export function ReviewWorkspace() {
  const { segment, drepId, poolId } = useSegment();
  const { ownDRepId } = useWallet();

  // Determine voter identity
  const voterRole = segment === 'spo' ? 'spo' : 'drep';
  const voterId = segment === 'spo' ? poolId : ownDRepId || drepId;

  const { data, isLoading, error } = useReviewQueue(voterId, voterRole);
  const { getStatus, setStatus, reviewedCount } = useQueueState(voterId);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [voteTxHash, setVoteTxHash] = useState<string | null>(null);
  const [lastVote, setLastVote] = useState<string | null>(null);
  const [notesSheetOpen, setNotesSheetOpen] = useState(false);

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const selectedItem = items[selectedIndex] ?? null;

  // Track page view
  useEffect(() => {
    posthog.capture('review_workspace_viewed', { voter_role: voterRole });
  }, [voterRole]);

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
    setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    setVoteTxHash(null);
    setLastVote(null);
  }, [items.length]);

  const goPrev = useCallback(() => {
    setSelectedIndex((prev) => Math.max(prev - 1, 0));
    setVoteTxHash(null);
    setLastVote(null);
  }, []);

  const handleSelect = useCallback((index: number) => {
    setSelectedIndex(index);
    setVoteTxHash(null);
    setLastVote(null);
  }, []);

  // Vote success handler
  const handleVoteSuccess = useCallback(
    (vote: VoteChoice) => {
      if (!selectedItem) return;
      setStatus(selectedItem.txHash, selectedItem.proposalIndex, 'voted', vote);
      // We don't store the full txHash from the vote result here;
      // the ReviewActionZone shows the CardanoScan link directly.
      // After success, auto-advance after a brief delay if there's a next item.
      if (selectedIndex < items.length - 1) {
        setTimeout(() => goNext(), 1500);
      }
    },
    [selectedItem, setStatus, selectedIndex, items.length, goNext],
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
  if (items.length === 0) {
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

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0">
      {/* Queue rail */}
      <div className="md:w-72 md:shrink-0 md:border-r border-b md:border-b-0 border-border">
        <ReviewQueue
          items={items}
          selectedIndex={selectedIndex}
          onSelect={handleSelect}
          getStatus={getStatus}
          progress={progress}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {selectedItem && (
          <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-4">
            <ReviewBrief item={selectedItem} />

            <ReviewActionZone
              item={selectedItem}
              drepId={voterId}
              onVote={(_txHash, _index, vote) => handleVoteSuccess(vote as VoteChoice)}
              onNextProposal={goNext}
            />

            {/* Post-vote share (placeholder for PR 3) */}
            {voteTxHash && lastVote && (
              <PostVoteShare
                drepId={voterId}
                txHash={selectedItem.txHash}
                index={selectedItem.proposalIndex}
                vote={lastVote}
                proposalTitle={selectedItem.title || 'Governance Proposal'}
                onNextProposal={goNext}
              />
            )}
          </div>
        )}
      </div>

      {/* Desktop: Notes & Journal sidebar */}
      {selectedItem && (
        <div className="hidden lg:block w-80 shrink-0 border-l border-border overflow-y-auto">
          <div className="p-3 space-y-3">
            <ProposalNotes
              proposalTxHash={selectedItem.txHash}
              proposalIndex={selectedItem.proposalIndex}
              userId={userId}
            />
            <DecisionJournal
              proposalTxHash={selectedItem.txHash}
              proposalIndex={selectedItem.proposalIndex}
              userId={userId}
            />
          </div>
        </div>
      )}

      {/* Mobile: Floating button + Sheet for notes/journal */}
      {selectedItem && (
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
                  proposalTxHash={selectedItem.txHash}
                  proposalIndex={selectedItem.proposalIndex}
                  userId={userId}
                />
                <DecisionJournal
                  proposalTxHash={selectedItem.txHash}
                  proposalIndex={selectedItem.proposalIndex}
                  userId={userId}
                />
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
