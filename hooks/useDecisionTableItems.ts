'use client';

import { useMemo } from 'react';
import type {
  ReviewQueueResponse,
  ProposalDraft,
  QueueItemStatus,
  DecisionTableItem,
  ConstitutionalRiskLevel,
} from '@/lib/workspace/types';

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function mapConstitutionalRisk(
  check: ProposalDraft['lastConstitutionalCheck'],
): ConstitutionalRiskLevel | null {
  if (!check) return null;
  const { score, flags } = check;
  if (score === 'fail') return 'HIGH';
  if (score === 'warning') {
    const hasCritical = flags.some((f) => f.severity === 'critical');
    return hasCritical ? 'HIGH' : 'MEDIUM';
  }
  return flags.length > 0 ? 'LOW' : 'NONE';
}

/**
 * Normalizes review queue items and reviewable drafts into a unified
 * DecisionTableItem[] for the decision table view.
 */
export function useDecisionTableItems(
  queueData: ReviewQueueResponse | undefined,
  draftsData: { drafts: ProposalDraft[] } | undefined,
  getStatus: (txHash: string, proposalIndex: number) => QueueItemStatus,
): DecisionTableItem[] {
  return useMemo(() => {
    const items: DecisionTableItem[] = [];

    // Community drafts -> feedback phase
    const drafts = draftsData?.drafts ?? [];
    for (const draft of drafts) {
      const reviewStatus = draft.yourReviewStatus;
      items.push({
        id: `draft-${draft.id}`,
        phase: 'feedback',
        title: draft.title || 'Untitled Draft',
        proposalType: draft.proposalType,
        epochsRemaining: null,
        isUrgent: false,
        daysInReview: daysSince(draft.communityReviewStartedAt),
        treasuryAmount:
          draft.proposalType === 'TreasuryWithdrawals'
            ? ((draft.typeSpecific?.withdrawal_amount as number) ?? null)
            : null,
        treasuryTier: null,
        communitySignal: null,
        constitutionalRisk: mapConstitutionalRisk(draft.lastConstitutionalCheck),
        status: reviewStatus === 'reviewed' ? 'feedback_given' : 'unreviewed',
        voteChoice: null,
        href: `/workspace/author/${draft.id}`,
      });
    }

    // On-chain proposals -> voting or completed phase
    const queueItems = queueData?.items ?? [];
    for (const item of queueItems) {
      const hasVoted = !!item.existingVote;
      const localStatus = hasVoted ? 'voted' : getStatus(item.txHash, item.proposalIndex);
      items.push({
        id: `vote-${item.txHash}-${item.proposalIndex}`,
        phase: hasVoted ? 'completed' : 'voting',
        title: item.title || 'Untitled Proposal',
        proposalType: item.proposalType,
        epochsRemaining: item.epochsRemaining,
        isUrgent: item.isUrgent,
        daysInReview: null,
        treasuryAmount: item.withdrawalAmount,
        treasuryTier: item.treasuryTier,
        communitySignal: item.citizenSentiment,
        constitutionalRisk: null, // Not yet available from API
        status:
          localStatus === 'voted' ? 'voted' : localStatus === 'snoozed' ? 'snoozed' : 'unreviewed',
        voteChoice: item.existingVote,
        href: `/workspace/review?proposal=${encodeURIComponent(item.txHash)}:${item.proposalIndex}`,
      });
    }

    // Sort: feedback first, then voting by urgency, then completed
    items.sort((a, b) => {
      const phaseOrder = { feedback: 0, voting: 1, completed: 2 };
      const phaseDiff = phaseOrder[a.phase] - phaseOrder[b.phase];
      if (phaseDiff !== 0) return phaseDiff;

      // Within voting: fewer epochs remaining first
      if (a.phase === 'voting' && b.phase === 'voting') {
        const aE = a.epochsRemaining ?? Infinity;
        const bE = b.epochsRemaining ?? Infinity;
        return aE - bE;
      }

      return 0;
    });

    return items;
  }, [queueData, draftsData, getStatus]);
}
