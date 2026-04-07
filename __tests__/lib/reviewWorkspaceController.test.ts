import { describe, expect, it } from 'vitest';
import {
  buildReviewProgress,
  findAutoAdvanceReviewIndex,
  findNextUnreviewedIndex,
  findPreviousUnreviewedIndex,
  getReviewSegmentBadge,
  resolveInitialReviewIndex,
} from '@/lib/workspace/reviewWorkspaceController';
import type { QueueItemStatus, ReviewQueueItem } from '@/lib/workspace/types';

function createItem(
  overrides: Partial<ReviewQueueItem> & Pick<ReviewQueueItem, 'txHash' | 'proposalIndex'>,
): ReviewQueueItem {
  return {
    txHash: overrides.txHash,
    proposalIndex: overrides.proposalIndex,
    title: overrides.title ?? 'Untitled',
    abstract: overrides.abstract ?? null,
    aiSummary: overrides.aiSummary ?? null,
    proposalType: overrides.proposalType ?? 'InfoAction',
    paramChanges: overrides.paramChanges ?? null,
    withdrawalAmount: overrides.withdrawalAmount ?? null,
    treasuryTier: overrides.treasuryTier ?? null,
    epochsRemaining: overrides.epochsRemaining ?? null,
    isUrgent: overrides.isUrgent ?? false,
    interBodyVotes:
      overrides.interBodyVotes ??
      ({
        drep: { yes: 0, no: 0, abstain: 0 },
        spo: { yes: 0, no: 0, abstain: 0 },
        cc: { yes: 0, no: 0, abstain: 0 },
      } as ReviewQueueItem['interBodyVotes']),
    citizenSentiment: overrides.citizenSentiment ?? null,
    existingVote: overrides.existingVote ?? null,
    sealedUntil: overrides.sealedUntil ?? null,
    motivation: overrides.motivation ?? null,
    rationale: overrides.rationale ?? null,
    references: overrides.references ?? null,
  };
}

function createStatusReader(statuses: Record<string, QueueItemStatus>) {
  return (txHash: string, proposalIndex: number): QueueItemStatus =>
    statuses[`${txHash}:${proposalIndex}`] ?? 'unreviewed';
}

describe('reviewWorkspaceController helpers', () => {
  const items = [
    createItem({ txHash: 'tx-1', proposalIndex: 0 }),
    createItem({ txHash: 'tx-2', proposalIndex: 0 }),
    createItem({ txHash: 'tx-3', proposalIndex: 0, existingVote: 'Yes' }),
  ];

  it('resolves the deep-linked proposal before auto-select logic', () => {
    const getStatus = createStatusReader({});

    expect(resolveInitialReviewIndex(items, getStatus, -1, 'tx-2:0')).toBe(1);
  });

  it('auto-selects the first unreviewed item when no deep link is present', () => {
    const getStatus = createStatusReader({ 'tx-1:0': 'voted' });

    expect(resolveInitialReviewIndex(items, getStatus, -1)).toBe(1);
  });

  it('wraps to the next and previous unreviewed items', () => {
    const getStatus = createStatusReader({
      'tx-1:0': 'voted',
      'tx-2:0': 'unreviewed',
      'tx-3:0': 'unreviewed',
    });

    expect(findNextUnreviewedIndex(items, getStatus, 2)).toBe(1);
    expect(findPreviousUnreviewedIndex(items, getStatus, 1)).toBe(1);
  });

  it('auto-advances to the next queue item when nothing unreviewed remains ahead', () => {
    const getStatus = createStatusReader({
      'tx-1:0': 'voted',
      'tx-2:0': 'voted',
      'tx-3:0': 'unreviewed',
    });

    expect(findAutoAdvanceReviewIndex(items, getStatus, 1)).toBe(2);
  });

  it('counts local votes plus pre-existing on-chain votes in review progress', () => {
    const getStatus = createStatusReader({ 'tx-1:0': 'voted' });
    const reviewedCount = () => 1;

    expect(buildReviewProgress(items, getStatus, reviewedCount)).toEqual({
      reviewed: 2,
      total: 3,
    });
  });

  it('derives runtime badge metadata from the reviewer segment', () => {
    expect(getReviewSegmentBadge('spo')).toEqual({ label: 'SPO', color: '#f59e0b' });
  });
});
