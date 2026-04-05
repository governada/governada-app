'use client';

import { CheckCircle2, Vote } from 'lucide-react';
import { StudioActionBar } from '@/components/studio/StudioActionBar';
import { StudioHeader } from '@/components/studio/StudioHeader';
import { StudioProvider } from '@/components/studio/StudioProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { ReviewWorkspaceStudioShell } from '@/components/workspace/review/ReviewWorkspaceStudio';
import { useReviewWorkspaceController } from '@/hooks/useReviewWorkspaceController';

interface ReviewWorkspaceProps {
  initialProposalKey?: string;
}

/**
 * Top-level client entrypoint for /workspace/review.
 * Keeps route-level state ownership in one controller hook and delegates
 * the interactive studio shell to ReviewWorkspaceStudio.
 */
export function ReviewWorkspace({ initialProposalKey }: ReviewWorkspaceProps = {}) {
  const {
    currentDraft,
    draftItems,
    error,
    getStatus,
    goNext,
    goPrev,
    handleEditorReady,
    handleQueueJump,
    handleVoteSuccess,
    isLoading,
    items,
    progress,
    queueLabels,
    reviewSession,
    segment,
    segmentBadge,
    selectedIndex,
    selectedItem,
    setSelectedIndex,
    stakeAddress,
    unreadCount,
    voteToast,
    voterId,
  } = useReviewWorkspaceController({ initialProposalKey });

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="h-12 border-t-2 border-teal-500 border-b border-b-border bg-background px-4 flex items-center shrink-0">
          <Skeleton className="h-5 w-24" />
          <div className="flex-1" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="flex-1 flex items-start justify-center pt-12">
          <div className="max-w-3xl w-full px-6 space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
        </div>
        <div className="h-12 border-t border-border bg-background shrink-0" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">Failed to load review queue</p>
          <p className="text-xs text-muted-foreground/60">{String(error)}</p>
        </div>
      </div>
    );
  }

  if (!voterId) {
    return (
      <div className="flex items-center justify-center h-screen">
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

  if (items.length === 0 && draftItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
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

  if (!selectedItem) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (progress.reviewed >= progress.total && progress.total > 0) {
    return (
      <StudioProvider>
        <div className="flex flex-col h-screen">
          <StudioHeader
            backLabel="governada"
            backHref="/workspace"
            queueProgress={{ current: progress.total, total: progress.total }}
            segmentBadge={segmentBadge}
          />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">All caught up!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You&apos;ve reviewed all {progress.total} proposal
                  {progress.total !== 1 ? 's' : ''} in the queue.
                </p>
              </div>
              <a
                href="/workspace"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Back to workspace
              </a>
            </div>
          </div>
          <StudioActionBar
            mode="review"
            statusInfo={
              <span className="text-xs text-muted-foreground tabular-nums">
                {progress.reviewed} of {progress.total} reviewed
              </span>
            }
          />
        </div>
      </StudioProvider>
    );
  }

  return (
    <ReviewWorkspaceStudioShell
      selectedItem={selectedItem}
      selectedIndex={selectedIndex}
      items={items}
      progress={progress}
      goNext={goNext}
      goPrev={goPrev}
      handleVoteSuccess={handleVoteSuccess}
      handleEditorReady={handleEditorReady}
      handleQueueJump={handleQueueJump}
      stakeAddress={stakeAddress}
      voterId={voterId}
      segmentBadge={segmentBadge}
      unreadCount={unreadCount}
      voteToast={voteToast}
      getStatus={getStatus}
      queueLabels={queueLabels}
      segment={segment}
      onSelectIndex={setSelectedIndex}
      currentDraft={currentDraft}
      reviewSession={reviewSession}
    />
  );
}
