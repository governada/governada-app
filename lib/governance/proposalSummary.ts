export type ProposalStatus = 'active' | 'ratified' | 'enacted' | 'expired' | 'dropped';

export interface TriBodyVotes {
  drep: { yes: number; no: number; abstain: number };
  spo: { yes: number; no: number; abstain: number };
  cc: { yes: number; no: number; abstain: number };
}

interface ProposalVotingSummaryRow {
  drep_yes_votes_cast: number | null;
  drep_no_votes_cast: number | null;
  drep_abstain_votes_cast: number | null;
  pool_yes_votes_cast: number | null;
  pool_no_votes_cast: number | null;
  pool_abstain_votes_cast: number | null;
  committee_yes_votes_cast: number | null;
  committee_no_votes_cast: number | null;
  committee_abstain_votes_cast: number | null;
}

interface ProposalSummaryRow {
  tx_hash: string;
  proposal_index: number;
  title: string | null;
  abstract: string | null;
  proposal_type: string;
  withdrawal_amount: number | string | null;
  treasury_tier: string | null;
  relevant_prefs: string[] | null;
  proposed_epoch: number | null;
  block_time: number | null;
  ai_summary: string | null;
  ratified_epoch: number | null;
  enacted_epoch: number | null;
  dropped_epoch: number | null;
  expired_epoch: number | null;
  expiration_epoch: number | null;
  param_changes: Record<string, unknown> | null;
}

interface ProposalDRepVoteRow {
  vote: 'Yes' | 'No' | 'Abstain';
  drep_id: string | null;
}

interface ProposalDRepVoteCounts {
  yes: number;
  no: number;
  abstain: number;
}

export interface ProposalWithVoteSummary {
  txHash: string;
  proposalIndex: number;
  title: string | null;
  abstract: string | null;
  proposalType: string;
  status: ProposalStatus;
  withdrawalAmount: number | null;
  treasuryTier: string | null;
  relevantPrefs: string[];
  proposedEpoch: number | null;
  blockTime: number | null;
  aiSummary: string | null;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  totalVotes: number;
  voterDrepIds: string[];
  ratifiedEpoch: number | null;
  enactedEpoch: number | null;
  droppedEpoch: number | null;
  expiredEpoch: number | null;
  expirationEpoch: number | null;
  triBody?: TriBodyVotes;
  paramChanges: Record<string, unknown> | null;
}

export function buildTriBodyVotes(summary: ProposalVotingSummaryRow): TriBodyVotes {
  return {
    drep: {
      yes: summary.drep_yes_votes_cast || 0,
      no: summary.drep_no_votes_cast || 0,
      abstain: summary.drep_abstain_votes_cast || 0,
    },
    spo: {
      yes: summary.pool_yes_votes_cast || 0,
      no: summary.pool_no_votes_cast || 0,
      abstain: summary.pool_abstain_votes_cast || 0,
    },
    cc: {
      yes: summary.committee_yes_votes_cast || 0,
      no: summary.committee_no_votes_cast || 0,
      abstain: summary.committee_abstain_votes_cast || 0,
    },
  };
}

export function getProposalStatus(proposal: {
  enactedEpoch: number | null;
  ratifiedEpoch: number | null;
  expiredEpoch: number | null;
  droppedEpoch: number | null;
}): ProposalStatus {
  if (proposal.enactedEpoch != null) return 'enacted';
  if (proposal.ratifiedEpoch != null) return 'ratified';
  if (proposal.expiredEpoch != null) return 'expired';
  if (proposal.droppedEpoch != null) return 'dropped';
  return 'active';
}

export function summarizeDRepVotes(votes: ProposalDRepVoteRow[] | null | undefined): {
  drepCounts: ProposalDRepVoteCounts;
  voterDrepIds: string[];
} {
  const drepCounts: ProposalDRepVoteCounts = { yes: 0, no: 0, abstain: 0 };
  const voterDrepIds = new Set<string>();

  for (const vote of votes ?? []) {
    if (vote.vote === 'Yes') drepCounts.yes += 1;
    else if (vote.vote === 'No') drepCounts.no += 1;
    else drepCounts.abstain += 1;

    if (vote.drep_id) {
      voterDrepIds.add(vote.drep_id);
    }
  }

  return { drepCounts, voterDrepIds: [...voterDrepIds] };
}

export function buildProposalVoteSummary({
  proposal,
  drepCounts,
  voterDrepIds,
  triBody,
}: {
  proposal: ProposalSummaryRow;
  drepCounts?: Partial<ProposalDRepVoteCounts> | null;
  voterDrepIds?: Iterable<string> | null;
  triBody?: TriBodyVotes;
}): ProposalWithVoteSummary {
  const yesCount = drepCounts?.yes ?? 0;
  const noCount = drepCounts?.no ?? 0;
  const abstainCount = drepCounts?.abstain ?? 0;
  const lifecycle = {
    ratifiedEpoch: proposal.ratified_epoch ?? null,
    enactedEpoch: proposal.enacted_epoch ?? null,
    droppedEpoch: proposal.dropped_epoch ?? null,
    expiredEpoch: proposal.expired_epoch ?? null,
  };

  return {
    txHash: proposal.tx_hash,
    proposalIndex: proposal.proposal_index,
    title: proposal.title,
    abstract: proposal.abstract,
    proposalType: proposal.proposal_type,
    status: getProposalStatus(lifecycle),
    withdrawalAmount:
      proposal.withdrawal_amount != null ? Number(proposal.withdrawal_amount) : null,
    treasuryTier: proposal.treasury_tier,
    relevantPrefs: proposal.relevant_prefs || [],
    proposedEpoch: proposal.proposed_epoch,
    blockTime: proposal.block_time,
    aiSummary: proposal.ai_summary || null,
    yesCount,
    noCount,
    abstainCount,
    totalVotes: yesCount + noCount + abstainCount,
    voterDrepIds: voterDrepIds ? [...new Set(voterDrepIds)] : [],
    ratifiedEpoch: lifecycle.ratifiedEpoch,
    enactedEpoch: lifecycle.enactedEpoch,
    droppedEpoch: lifecycle.droppedEpoch,
    expiredEpoch: lifecycle.expiredEpoch,
    expirationEpoch: proposal.expiration_epoch ?? null,
    triBody,
    paramChanges: proposal.param_changes ?? null,
  };
}
