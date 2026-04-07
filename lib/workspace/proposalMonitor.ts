import { GOVERNANCE_ACTION_DEPOSIT_LOVELACE } from '@/lib/governance/constants';
import { fetchLatestProposalVotingSummary } from '@/lib/governance/proposalVotingSummary';
import { getVotingBodies } from '@/lib/governance/votingBodies';
import { getGovernanceThresholdForProposal } from '@/lib/governanceThresholds';
import { blockTimeToEpoch } from '@/lib/koios';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ProposalMonitorData } from '@/lib/workspace/monitor-types';

const CC_APPROVAL_THRESHOLD = 2 / 3;
const STANDARD_SPO_APPROVAL_THRESHOLD = 0.51;
const INFO_ACTION_APPROVAL_THRESHOLD = 1;

export class ProposalMonitorError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ProposalMonitorError';
    this.status = status;
  }
}

function deriveStatus(proposal: {
  ratified_epoch: number | null;
  enacted_epoch: number | null;
  expired_epoch: number | null;
  dropped_epoch: number | null;
}): ProposalMonitorData['status'] {
  if (proposal.enacted_epoch != null) return 'enacted';
  if (proposal.ratified_epoch != null) return 'ratified';
  if (proposal.expired_epoch != null) return 'expired';
  if (proposal.dropped_epoch != null) return 'dropped';
  return 'voting';
}

function deriveDepositStatus(
  status: ProposalMonitorData['deposit']['status'] | ProposalMonitorData['status'],
): ProposalMonitorData['deposit']['status'] {
  if (status === 'voting') return 'locked';
  if (status === 'dropped') return 'at_risk';
  return 'returned';
}

export async function buildProposalMonitorData({
  txHash,
  proposalIndex,
  now = Date.now(),
}: {
  txHash: string;
  proposalIndex: number;
  now?: number;
}): Promise<ProposalMonitorData> {
  const supabase = getSupabaseAdmin();
  const currentEpoch = blockTimeToEpoch(Math.floor(now / 1000));

  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('*')
    .eq('tx_hash', txHash)
    .eq('proposal_index', proposalIndex)
    .maybeSingle();

  if (proposalError) {
    logger.error('[monitor] Failed to fetch proposal', {
      error: proposalError,
      txHash,
      proposalIndex,
    });
    throw new ProposalMonitorError(500, 'Failed to fetch proposal');
  }

  if (!proposal) {
    throw new ProposalMonitorError(404, 'Proposal not found');
  }

  const paramChanges = (proposal.param_changes as Record<string, unknown> | null) ?? null;
  const status = deriveStatus(proposal);
  const eligibleBodies = new Set(getVotingBodies(proposal.proposal_type, paramChanges));
  const drepThreshold =
    proposal.proposal_type === 'InfoAction'
      ? INFO_ACTION_APPROVAL_THRESHOLD
      : (
          await getGovernanceThresholdForProposal({
            proposalType: proposal.proposal_type,
            paramChanges,
          })
        ).threshold;

  if (drepThreshold == null) {
    logger.error('[monitor] Missing DRep threshold configuration', {
      proposalType: proposal.proposal_type,
      txHash,
      proposalIndex,
    });
    throw new ProposalMonitorError(500, 'Unsupported proposal threshold configuration');
  }

  const summary = await fetchLatestProposalVotingSummary(supabase, { txHash, proposalIndex });

  const voting: ProposalMonitorData['voting'] = {
    drep: {
      yesCount: summary?.drep_yes_votes_cast ?? 0,
      yesVotePower: summary?.drep_yes_vote_power ?? 0,
      noCount: summary?.drep_no_votes_cast ?? 0,
      noVotePower: summary?.drep_no_vote_power ?? 0,
      abstainCount: summary?.drep_abstain_votes_cast ?? 0,
      abstainVotePower: summary?.drep_abstain_vote_power ?? 0,
      threshold: drepThreshold,
    },
  };

  if (eligibleBodies.has('spo')) {
    voting.spo = {
      yesCount: summary?.pool_yes_votes_cast ?? 0,
      yesVotePower: summary?.pool_yes_vote_power ?? 0,
      noCount: summary?.pool_no_votes_cast ?? 0,
      noVotePower: summary?.pool_no_vote_power ?? 0,
      abstainCount: summary?.pool_abstain_votes_cast ?? 0,
      abstainVotePower: summary?.pool_abstain_vote_power ?? 0,
      threshold:
        proposal.proposal_type === 'InfoAction'
          ? INFO_ACTION_APPROVAL_THRESHOLD
          : STANDARD_SPO_APPROVAL_THRESHOLD,
    };
  }

  if (eligibleBodies.has('cc')) {
    voting.cc = {
      yesCount: summary?.committee_yes_votes_cast ?? 0,
      noCount: summary?.committee_no_votes_cast ?? 0,
      abstainCount: summary?.committee_abstain_votes_cast ?? 0,
      threshold: CC_APPROVAL_THRESHOLD,
    };
  }

  const { data: recentVoteRows } = await supabase
    .from('drep_votes')
    .select('drep_id, vote, epoch_no, block_time, meta_url, has_rationale')
    .eq('proposal_tx_hash', txHash)
    .eq('proposal_index', proposalIndex)
    .order('block_time', { ascending: false })
    .limit(10);

  const recentVotes: ProposalMonitorData['recentVotes'] =
    recentVoteRows?.map((vote) => ({
      voterId: vote.drep_id,
      voterType: 'drep' as const,
      vote: vote.vote as 'Yes' | 'No' | 'Abstain',
      epochNo: vote.epoch_no != null ? vote.epoch_no : blockTimeToEpoch(vote.block_time),
      hasRationale: vote.has_rationale ?? !!vote.meta_url,
    })) ?? [];

  const epochsRemaining =
    status === 'voting' && proposal.expiration_epoch != null
      ? Math.max(0, proposal.expiration_epoch - currentEpoch)
      : null;

  return {
    txHash: proposal.tx_hash,
    proposalIndex: proposal.proposal_index,
    title: proposal.title ?? 'Untitled Proposal',
    proposalType: proposal.proposal_type,
    status,
    proposedEpoch: proposal.proposed_epoch,
    ratifiedEpoch: proposal.ratified_epoch,
    enactedEpoch: proposal.enacted_epoch,
    expiredEpoch: proposal.expired_epoch,
    droppedEpoch: proposal.dropped_epoch,
    expirationEpoch: proposal.expiration_epoch,
    voting,
    recentVotes,
    deposit: {
      amount: GOVERNANCE_ACTION_DEPOSIT_LOVELACE,
      status: deriveDepositStatus(status),
      returnAddress: null as string | null,
    },
    currentEpoch,
    epochsRemaining,
  };
}
