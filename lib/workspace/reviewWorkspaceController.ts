import type { ProposalDraft, QueueItemStatus, ReviewQueueItem } from '@/lib/workspace/types';

export interface ReviewProgress {
  reviewed: number;
  total: number;
}

export interface ReviewSegmentBadge {
  label: string;
  color: string;
}

type ReviewStatusReader = (txHash: string, proposalIndex: number) => QueueItemStatus | undefined;
type ReviewedCountReader = (items: Array<{ txHash: string; proposalIndex: number }>) => number;

function parseInitialProposalKey(
  initialProposalKey?: string,
): { txHash: string; proposalIndex: number } | null {
  if (!initialProposalKey) return null;

  const [txHash, proposalIndexRaw] = initialProposalKey.split(':');
  if (!txHash || !proposalIndexRaw) return null;

  const proposalIndex = parseInt(proposalIndexRaw, 10);
  if (Number.isNaN(proposalIndex)) return null;

  return { txHash, proposalIndex };
}

export function isReviewItemComplete(
  item: Pick<ReviewQueueItem, 'txHash' | 'proposalIndex' | 'existingVote'>,
  getStatus: ReviewStatusReader,
): boolean {
  return getStatus(item.txHash, item.proposalIndex) === 'voted' || !!item.existingVote;
}

export function resolveInitialReviewIndex(
  items: ReviewQueueItem[],
  getStatus: ReviewStatusReader,
  selectedIndex: number,
  initialProposalKey?: string,
): number {
  if (items.length === 0) return selectedIndex;

  const initialTarget = parseInitialProposalKey(initialProposalKey);
  if (initialTarget) {
    const matchIndex = items.findIndex(
      (item) =>
        item.txHash === initialTarget.txHash && item.proposalIndex === initialTarget.proposalIndex,
    );
    if (matchIndex >= 0) {
      return matchIndex;
    }
  }

  if (selectedIndex !== -1) {
    return selectedIndex;
  }

  const firstUnreviewed = items.findIndex((item) => !isReviewItemComplete(item, getStatus));
  return firstUnreviewed >= 0 ? firstUnreviewed : 0;
}

export function findNextUnreviewedIndex(
  items: ReviewQueueItem[],
  getStatus: ReviewStatusReader,
  currentIndex: number,
): number {
  for (let index = currentIndex + 1; index < items.length; index += 1) {
    if (!isReviewItemComplete(items[index], getStatus)) {
      return index;
    }
  }

  for (let index = 0; index < currentIndex; index += 1) {
    if (!isReviewItemComplete(items[index], getStatus)) {
      return index;
    }
  }

  return currentIndex;
}

export function findPreviousUnreviewedIndex(
  items: ReviewQueueItem[],
  getStatus: ReviewStatusReader,
  currentIndex: number,
): number {
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (!isReviewItemComplete(items[index], getStatus)) {
      return index;
    }
  }

  for (let index = items.length - 1; index > currentIndex; index -= 1) {
    if (!isReviewItemComplete(items[index], getStatus)) {
      return index;
    }
  }

  return currentIndex;
}

export function findAutoAdvanceReviewIndex(
  items: ReviewQueueItem[],
  getStatus: ReviewStatusReader,
  currentIndex: number,
): number {
  for (let index = currentIndex + 1; index < items.length; index += 1) {
    if (!isReviewItemComplete(items[index], getStatus)) {
      return index;
    }
  }

  if (currentIndex < items.length - 1) {
    return currentIndex + 1;
  }

  return currentIndex;
}

export function buildReviewProgress(
  items: ReviewQueueItem[],
  getStatus: ReviewStatusReader,
  reviewedCount: ReviewedCountReader,
): ReviewProgress {
  const locallyReviewed = reviewedCount(items);
  const alreadyVoted = items.filter(
    (item) => item.existingVote && getStatus(item.txHash, item.proposalIndex) !== 'voted',
  ).length;

  return {
    reviewed: locallyReviewed + alreadyVoted,
    total: items.length,
  };
}

export function findCurrentDraft(
  selectedItem: Pick<ReviewQueueItem, 'txHash'> | null,
  drafts?: ProposalDraft[],
): ProposalDraft | undefined {
  if (!selectedItem || !drafts) return undefined;
  return drafts.find((draft) => draft.id === selectedItem.txHash);
}

export function getReviewSegmentBadge(segment: string): ReviewSegmentBadge | undefined {
  const badges: Record<string, ReviewSegmentBadge> = {
    drep: { label: 'DRep', color: '#6366f1' },
    spo: { label: 'SPO', color: '#f59e0b' },
    cc: { label: 'CC', color: '#ef4444' },
  };

  return badges[segment];
}
