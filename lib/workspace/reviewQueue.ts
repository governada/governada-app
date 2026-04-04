import { blockTimeToEpoch } from '@/lib/koios';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase';
import type {
  CitizenSentiment,
  InterBodyVotes,
  ReviewQueueItem,
  ReviewQueueResponse,
} from '@/lib/workspace/types';
import { getProposalDisplayTitle } from '@/utils/display';

function extractMetaField(metaJson: unknown, field: string): string | null {
  if (!metaJson || typeof metaJson !== 'object') return null;

  const body =
    'body' in metaJson && metaJson.body && typeof metaJson.body === 'object'
      ? (metaJson.body as Record<string, unknown>)
      : (metaJson as Record<string, unknown>);
  const value = body[field];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

type ProposalReference = NonNullable<ReviewQueueItem['references']>[number];

function extractMetaReferences(metaJson: unknown): ProposalReference[] | null {
  if (!metaJson || typeof metaJson !== 'object') return null;

  const body =
    'body' in metaJson && metaJson.body && typeof metaJson.body === 'object'
      ? (metaJson.body as Record<string, unknown>)
      : (metaJson as Record<string, unknown>);
  const refs = body.references;
  if (!Array.isArray(refs) || refs.length === 0) return null;

  return refs
    .filter(
      (reference): reference is Record<string, unknown> =>
        !!reference &&
        typeof reference === 'object' &&
        (typeof reference.uri === 'string' || typeof reference.label === 'string'),
    )
    .map((reference) => ({
      type: String(reference['@type'] ?? 'Other'),
      label: String(reference.label ?? ''),
      uri: String(reference.uri ?? ''),
    }));
}

export async function buildReviewQueue({
  voterId,
  voterRole = 'drep',
  now = Date.now(),
}: {
  voterId: string;
  voterRole?: 'drep' | 'spo';
  now?: number;
}): Promise<ReviewQueueResponse> {
  const supabase = createClient();
  const currentEpoch = blockTimeToEpoch(Math.floor(now / 1000));

  const { data: proposals, error: proposalError } = await supabase
    .from('proposals')
    .select('*')
    .is('ratified_epoch', null)
    .is('enacted_epoch', null)
    .is('dropped_epoch', null)
    .is('expired_epoch', null)
    .order('block_time', { ascending: false });

  if (proposalError || !proposals || proposals.length === 0) {
    return {
      items: [],
      currentEpoch,
      totalOpen: 0,
    };
  }

  const openProposals = proposals.filter((proposal) => {
    if (!proposal.expiration_epoch) return true;
    return proposal.expiration_epoch >= currentEpoch;
  });
  const txHashes =
    openProposals.length > 0 ? openProposals.map((proposal) => proposal.tx_hash) : ['__none__'];

  const [voterVotesResult, votingSummaryResult, sentimentResult] = await Promise.all([
    voterRole === 'drep'
      ? supabase
          .from('drep_votes')
          .select('proposal_tx_hash, proposal_index, vote')
          .eq('drep_id', voterId)
          .in('proposal_tx_hash', txHashes)
      : supabase
          .from('spo_votes')
          .select('proposal_tx_hash, proposal_index, vote')
          .eq('pool_id', voterId)
          .in('proposal_tx_hash', txHashes),
    supabase.from('proposal_voting_summary').select('*').in('proposal_tx_hash', txHashes),
    supabase
      .from('citizen_sentiment')
      .select('proposal_tx_hash, proposal_index, sentiment')
      .in('proposal_tx_hash', txHashes),
  ]);

  const voterVoteMap = new Map<string, string>();
  for (const vote of voterVotesResult.data ?? []) {
    voterVoteMap.set(`${vote.proposal_tx_hash}-${vote.proposal_index}`, vote.vote);
  }

  const summaryMap = new Map<string, InterBodyVotes>();
  for (const summary of votingSummaryResult.data ?? []) {
    summaryMap.set(`${summary.proposal_tx_hash}-${summary.proposal_index}`, {
      drep: {
        yes: summary.drep_yes_votes_cast ?? 0,
        no: summary.drep_no_votes_cast ?? 0,
        abstain: summary.drep_abstain_votes_cast ?? 0,
      },
      spo: {
        yes: summary.pool_yes_votes_cast ?? 0,
        no: summary.pool_no_votes_cast ?? 0,
        abstain: summary.pool_abstain_votes_cast ?? 0,
      },
      cc: {
        yes: summary.committee_yes_votes_cast ?? 0,
        no: summary.committee_no_votes_cast ?? 0,
        abstain: summary.committee_abstain_votes_cast ?? 0,
      },
    });
  }

  const sentimentMap = new Map<string, CitizenSentiment>();
  for (const sentiment of sentimentResult.data ?? []) {
    const key = `${sentiment.proposal_tx_hash}-${sentiment.proposal_index}`;
    const entry = sentimentMap.get(key) ?? { support: 0, oppose: 0, abstain: 0, total: 0 };
    const value = (sentiment.sentiment ?? '').toLowerCase();
    if (value === 'support' || value === 'yes') entry.support += 1;
    else if (value === 'oppose' || value === 'no') entry.oppose += 1;
    else entry.abstain += 1;
    entry.total += 1;
    sentimentMap.set(key, entry);
  }

  const items: ReviewQueueItem[] = openProposals.map((proposal) => {
    const key = `${proposal.tx_hash}-${proposal.proposal_index}`;
    const expiryEpoch = proposal.expiration_epoch ?? 0;
    const epochsRemaining = expiryEpoch > 0 ? Math.max(0, expiryEpoch - currentEpoch) : null;
    const defaultTally = { yes: 0, no: 0, abstain: 0 };

    return {
      txHash: proposal.tx_hash,
      proposalIndex: proposal.proposal_index,
      title: getProposalDisplayTitle(proposal.title, proposal.tx_hash, proposal.proposal_index),
      abstract: proposal.abstract ?? null,
      aiSummary: proposal.ai_summary ?? null,
      proposalType: proposal.proposal_type || 'Proposal',
      paramChanges: (proposal.param_changes as Record<string, unknown> | null) ?? null,
      withdrawalAmount:
        proposal.withdrawal_amount != null ? Number(proposal.withdrawal_amount) : null,
      treasuryTier: proposal.treasury_tier ?? null,
      epochsRemaining,
      isUrgent: epochsRemaining !== null && epochsRemaining <= 2,
      interBodyVotes: summaryMap.get(key) ?? {
        drep: { ...defaultTally },
        spo: { ...defaultTally },
        cc: { ...defaultTally },
      },
      citizenSentiment: sentimentMap.get(key) ?? null,
      existingVote: voterVoteMap.get(key) ?? null,
      sealedUntil: proposal.block_time
        ? new Date(proposal.block_time * 1000 + 5 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      motivation: extractMetaField(proposal.meta_json, 'motivation'),
      rationale: extractMetaField(proposal.meta_json, 'rationale'),
      references: extractMetaReferences(proposal.meta_json),
    };
  });

  items.sort((left, right) => {
    const leftVoted = left.existingVote ? 1 : 0;
    const rightVoted = right.existingVote ? 1 : 0;
    if (leftVoted !== rightVoted) return leftVoted - rightVoted;

    const leftRemaining = left.epochsRemaining ?? 999;
    const rightRemaining = right.epochsRemaining ?? 999;
    return leftRemaining - rightRemaining;
  });

  logger.info('[ReviewQueue] Fetched review queue', {
    voterId,
    voterRole,
    totalOpen: openProposals.length,
    itemCount: items.length,
  });

  return {
    items,
    currentEpoch,
    totalOpen: openProposals.length,
  };
}
