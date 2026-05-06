import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { extractAlignments, getDominantDimension, getIdentityColor } from '@/lib/drepIdentity';
import {
  computeTreasuryAmberSaturation,
  computeVotingWindowProgress,
  LAYER1_REPLAY_WINDOW_HOURS,
} from '@/lib/globe/layer1Constants';
import type {
  ChainActivityEvent,
  ChainActivityReplayResponse,
  ChainActivityVote,
} from '@/lib/chain/activityReplay';

export const dynamic = 'force-dynamic';

const MAX_ROWS_PER_BODY = 1_000;
const MAX_REPLAY_WINDOW_HOURS = 168;
const SHELLEY_GENESIS_TIMESTAMP = 1_596_491_091;
const EPOCH_LENGTH_SECONDS = 432_000;
const SHELLEY_BASE_EPOCH = 208;

type AlignmentRow = {
  alignment_treasury_conservative: number | null;
  alignment_treasury_growth: number | null;
  alignment_decentralization: number | null;
  alignment_security: number | null;
  alignment_innovation: number | null;
  alignment_transparency: number | null;
};

type DrepVoteReplayRow = {
  vote_tx_hash: string;
  drep_id: string;
  vote: string;
  block_time: number;
  proposal_tx_hash: string;
  proposal_index: number;
  voting_power_lovelace: number | null;
};

type SpoVoteReplayRow = {
  tx_hash: string;
  pool_id: string;
  vote: string;
  block_time: number;
  proposal_tx_hash: string;
  proposal_index: number;
};

type CcVoteReplayRow = {
  tx_hash: string;
  cc_hot_id: string;
  cc_cold_id: string | null;
  vote: string;
  block_time: number;
  proposal_tx_hash: string;
  proposal_index: number;
};

type RationaleReplayRow = {
  vote_tx_hash: string;
  drep_id: string;
  fetched_at: string | null;
  proposal_tx_hash: string | null;
  proposal_index: number | null;
};

type ProposalReplayRow = {
  tx_hash: string;
  proposal_index: number;
  title: string | null;
  proposal_type: string;
  block_time: number | null;
  proposed_epoch: number | null;
  expiration_epoch: number | null;
  ratified_epoch: number | null;
  enacted_epoch: number | null;
  dropped_epoch: number | null;
  expired_epoch: number | null;
  withdrawal_amount: number | null;
};

type DrepIdentityRow = AlignmentRow & { id: string };
type PoolIdentityRow = AlignmentRow & { pool_id: string; live_stake_lovelace: number | null };
type CcIdentityRow = AlignmentRow & { cc_hot_id: string; cc_cold_id: string | null };

function parseWindowHours(request: NextRequest): number {
  const raw = request.nextUrl.searchParams.get('hours');
  const parsed = raw ? Number.parseFloat(raw) : LAYER1_REPLAY_WINDOW_HOURS;
  if (!Number.isFinite(parsed)) return LAYER1_REPLAY_WINDOW_HOURS;
  return Math.max(1, Math.min(MAX_REPLAY_WINDOW_HOURS, Math.round(parsed)));
}

function proposalKey(txHash: string, proposalIndex: number): string {
  return `${txHash}#${proposalIndex}`;
}

function proposalNodeId(txHash: string, proposalIndex: number): string {
  return `proposal-${txHash.slice(0, 12)}-${proposalIndex}`;
}

function epochToUnixSeconds(epoch: number | null): number | null {
  if (epoch == null) return null;
  return (epoch - SHELLEY_BASE_EPOCH) * EPOCH_LENGTH_SECONDS + SHELLEY_GENESIS_TIMESTAMP;
}

function isOpenProposal(proposal: ProposalReplayRow): boolean {
  return (
    proposal.ratified_epoch == null &&
    proposal.enacted_epoch == null &&
    proposal.dropped_epoch == null &&
    proposal.expired_epoch == null
  );
}

function coerceVote(value: string): ChainActivityVote {
  if (value === 'Yes' || value === 'No' || value === 'Abstain') return value;
  return 'Abstain';
}

function identityColor(row: AlignmentRow | null | undefined): string {
  if (!row) return '#2dd4bf';
  return getIdentityColor(getDominantDimension(extractAlignments(row))).hex;
}

function indexById<T extends Record<K, string>, K extends keyof T>(
  rows: T[],
  key: K,
): Map<string, T> {
  return new Map(rows.map((row) => [row[key], row] as const));
}

export const GET = withRouteHandler(async (request) => {
  const supabase = createClient();
  const windowHours = parseWindowHours(request);
  const nowSeconds = Math.floor(Date.now() / 1_000);
  const sinceSeconds = nowSeconds - windowHours * 60 * 60;
  const sinceIso = new Date(sinceSeconds * 1_000).toISOString();

  const [drepVotesResult, spoVotesResult, ccVotesResult, rationalesResult, openProposalsResult] =
    await Promise.all([
      supabase
        .from('drep_votes')
        .select(
          'vote_tx_hash, drep_id, vote, block_time, proposal_tx_hash, proposal_index, voting_power_lovelace',
        )
        .gte('block_time', sinceSeconds)
        .order('block_time', { ascending: true })
        .limit(MAX_ROWS_PER_BODY),
      supabase
        .from('spo_votes')
        .select('tx_hash, pool_id, vote, block_time, proposal_tx_hash, proposal_index')
        .gte('block_time', sinceSeconds)
        .order('block_time', { ascending: true })
        .limit(MAX_ROWS_PER_BODY),
      supabase
        .from('cc_votes')
        .select(
          'tx_hash, cc_hot_id, cc_cold_id, vote, block_time, proposal_tx_hash, proposal_index',
        )
        .gte('block_time', sinceSeconds)
        .order('block_time', { ascending: true })
        .limit(MAX_ROWS_PER_BODY),
      supabase
        .from('vote_rationales')
        .select('vote_tx_hash, drep_id, fetched_at, proposal_tx_hash, proposal_index')
        .gte('fetched_at', sinceIso)
        .not('rationale_text', 'is', null)
        .order('fetched_at', { ascending: true })
        .limit(MAX_ROWS_PER_BODY),
      supabase
        .from('proposals')
        .select(
          'tx_hash, proposal_index, title, proposal_type, block_time, proposed_epoch, expiration_epoch, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch, withdrawal_amount',
        )
        .is('ratified_epoch', null)
        .is('enacted_epoch', null)
        .is('dropped_epoch', null)
        .is('expired_epoch', null)
        .order('block_time', { ascending: false })
        .limit(200),
    ]);

  const drepVotes = (drepVotesResult.data ?? []) as DrepVoteReplayRow[];
  const spoVotes = (spoVotesResult.data ?? []) as SpoVoteReplayRow[];
  const ccVotes = (ccVotesResult.data ?? []) as CcVoteReplayRow[];
  const rationales = (rationalesResult.data ?? []) as RationaleReplayRow[];
  const openProposals = (openProposalsResult.data ?? []) as ProposalReplayRow[];

  const proposalTxHashes = [
    ...new Set([
      ...drepVotes.map((vote) => vote.proposal_tx_hash),
      ...spoVotes.map((vote) => vote.proposal_tx_hash),
      ...ccVotes.map((vote) => vote.proposal_tx_hash),
      ...rationales.map((rationale) => rationale.proposal_tx_hash).filter(Boolean),
    ] as string[]),
  ];

  const [recentProposalsResult, drepsResult, poolsResult, ccMembersResult] = await Promise.all([
    proposalTxHashes.length > 0
      ? supabase
          .from('proposals')
          .select(
            'tx_hash, proposal_index, title, proposal_type, block_time, proposed_epoch, expiration_epoch, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch, withdrawal_amount',
          )
          .in('tx_hash', proposalTxHashes)
          .limit(500)
      : Promise.resolve({ data: [] }),
    drepVotes.length > 0 || rationales.length > 0
      ? supabase
          .from('dreps')
          .select(
            'id, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
          )
          .in('id', [
            ...new Set([
              ...drepVotes.map((vote) => vote.drep_id),
              ...rationales.map((rationale) => rationale.drep_id),
            ]),
          ])
      : Promise.resolve({ data: [] }),
    spoVotes.length > 0
      ? supabase
          .from('pools')
          .select(
            'pool_id, live_stake_lovelace, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
          )
          .in('pool_id', [...new Set(spoVotes.map((vote) => vote.pool_id))])
      : Promise.resolve({ data: [] }),
    ccVotes.length > 0
      ? supabase
          .from('cc_members')
          .select(
            'cc_hot_id, cc_cold_id, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
          )
          .in('cc_hot_id', [...new Set(ccVotes.map((vote) => vote.cc_hot_id))])
      : Promise.resolve({ data: [] }),
  ]);

  const allProposals = [
    ...((recentProposalsResult.data ?? []) as ProposalReplayRow[]),
    ...openProposals,
  ];
  const proposalMap = new Map<string, ProposalReplayRow>();
  for (const proposal of allProposals) {
    proposalMap.set(proposalKey(proposal.tx_hash, proposal.proposal_index), proposal);
  }

  const drepMap = indexById((drepsResult.data ?? []) as DrepIdentityRow[], 'id');
  const poolMap = indexById((poolsResult.data ?? []) as PoolIdentityRow[], 'pool_id');
  const ccMap = indexById((ccMembersResult.data ?? []) as CcIdentityRow[], 'cc_hot_id');
  const events: ChainActivityEvent[] = [];

  for (const vote of drepVotes) {
    const key = proposalKey(vote.proposal_tx_hash, vote.proposal_index);
    const proposal = proposalMap.get(key);
    const drep = drepMap.get(vote.drep_id);

    events.push({
      type: 'vote_cast',
      id: `vote-drep-${vote.vote_tx_hash}`,
      timestamp: vote.block_time,
      voterKind: 'drep',
      voterNodeId: vote.drep_id.slice(0, 16),
      voterFullId: vote.drep_id,
      voterIdentityColor: identityColor(drep),
      proposalNodeId: proposalNodeId(vote.proposal_tx_hash, vote.proposal_index),
      proposalKey: key,
      proposalTitle: proposal?.title ?? null,
      vote: coerceVote(vote.vote),
      influenceLovelace: vote.voting_power_lovelace,
    });
  }

  for (const vote of spoVotes) {
    const key = proposalKey(vote.proposal_tx_hash, vote.proposal_index);
    const proposal = proposalMap.get(key);
    const pool = poolMap.get(vote.pool_id);

    events.push({
      type: 'vote_cast',
      id: `vote-spo-${vote.tx_hash}-${vote.pool_id}`,
      timestamp: vote.block_time,
      voterKind: 'spo',
      voterNodeId: vote.pool_id.slice(0, 16),
      voterFullId: vote.pool_id,
      voterIdentityColor: identityColor(pool),
      proposalNodeId: proposalNodeId(vote.proposal_tx_hash, vote.proposal_index),
      proposalKey: key,
      proposalTitle: proposal?.title ?? null,
      vote: coerceVote(vote.vote),
      influenceLovelace: pool?.live_stake_lovelace ?? null,
    });
  }

  for (const vote of ccVotes) {
    const key = proposalKey(vote.proposal_tx_hash, vote.proposal_index);
    const proposal = proposalMap.get(key);
    const cc = ccMap.get(vote.cc_hot_id);

    events.push({
      type: 'vote_cast',
      id: `vote-cc-${vote.tx_hash}-${vote.cc_hot_id}`,
      timestamp: vote.block_time,
      voterKind: 'cc',
      voterNodeId: vote.cc_hot_id.slice(0, 16),
      voterFullId: vote.cc_hot_id,
      voterIdentityColor: identityColor(cc),
      proposalNodeId: proposalNodeId(vote.proposal_tx_hash, vote.proposal_index),
      proposalKey: key,
      proposalTitle: proposal?.title ?? null,
      vote: coerceVote(vote.vote),
      influenceLovelace: null,
    });
  }

  for (const rationale of rationales) {
    const timestamp = rationale.fetched_at
      ? Math.floor(new Date(rationale.fetched_at).getTime() / 1_000)
      : nowSeconds;
    const drep = drepMap.get(rationale.drep_id);
    const key =
      rationale.proposal_tx_hash && rationale.proposal_index != null
        ? proposalKey(rationale.proposal_tx_hash, rationale.proposal_index)
        : null;

    events.push({
      type: 'rationale_published',
      id: `rationale-${rationale.vote_tx_hash}`,
      timestamp,
      drepNodeId: rationale.drep_id.slice(0, 16),
      drepFullId: rationale.drep_id,
      drepIdentityColor: identityColor(drep),
      proposalNodeId:
        rationale.proposal_tx_hash && rationale.proposal_index != null
          ? proposalNodeId(rationale.proposal_tx_hash, rationale.proposal_index)
          : null,
      proposalKey: key,
      voteTxHash: rationale.vote_tx_hash,
    });
  }

  for (const proposal of openProposals.filter(isOpenProposal)) {
    const key = proposalKey(proposal.tx_hash, proposal.proposal_index);
    const openedAt = proposal.block_time ?? epochToUnixSeconds(proposal.proposed_epoch);
    const closedAt = epochToUnixSeconds(proposal.expiration_epoch);
    const progress = computeVotingWindowProgress(nowSeconds, openedAt, closedAt);

    events.push({
      type: 'proposal_voting_window_progress',
      id: `proposal-progress-${key}`,
      timestamp: nowSeconds,
      proposalNodeId: proposalNodeId(proposal.tx_hash, proposal.proposal_index),
      proposalKey: key,
      proposalTitle: proposal.title,
      progress,
    });

    if (proposal.proposal_type === 'TreasuryWithdrawals' && proposal.withdrawal_amount) {
      events.push({
        type: 'treasury_proposal_amber',
        id: `proposal-treasury-${key}`,
        timestamp: nowSeconds,
        proposalNodeId: proposalNodeId(proposal.tx_hash, proposal.proposal_index),
        proposalKey: key,
        proposalTitle: proposal.title,
        withdrawalAmountLovelace: Number(proposal.withdrawal_amount),
        amberSaturation: computeTreasuryAmberSaturation(Number(proposal.withdrawal_amount)),
      });
    }
  }

  events.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));

  const body: ChainActivityReplayResponse = {
    events,
    windowHours,
    generatedAt: new Date(nowSeconds * 1_000).toISOString(),
  };

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'no-store' },
  });
});
