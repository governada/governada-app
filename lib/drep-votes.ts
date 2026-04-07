import type { DRepVote } from '@/types/koios';
import type { ProposalContext } from '@/utils/scoring';
import { fetchAll } from '@/lib/sync-utils';
import { getSupabaseAdmin } from '@/lib/supabase';
import { RATIONALE_FETCH_STATUS, type StoredVoteRationaleRow } from '@/lib/vote-rationales';

export interface StoredDRepVoteRow {
  vote_tx_hash: string;
  drep_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  vote: DRepVote['vote'];
  epoch_no: number | null;
  block_time: number;
  meta_url: string | null;
  meta_hash: string | null;
  has_rationale: boolean;
}

type VoteRationaleSignal = Pick<DRepVote, 'meta_url' | 'meta_json'> & {
  has_rationale?: boolean | null;
};

type WeightedVoteRationaleSignal = VoteRationaleSignal & {
  proposal_tx_hash: DRepVote['proposal_tx_hash'];
  proposal_index: DRepVote['proposal_index'];
};

const CRITICAL_PROPOSAL_TYPES = [
  'HardForkInitiation',
  'NoConfidence',
  'NewCommittee',
  'NewConstitutionalCommittee',
  'NewConstitution',
  'UpdateConstitution',
];

const RATIONALE_EXEMPT_TYPES = ['InfoAction'];

function extractStructuredText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractStructuredText(item);
      if (extracted) return extracted;
    }
    return null;
  }
  if (value && typeof value === 'object' && '@value' in value) {
    const inner = (value as Record<string, unknown>)['@value'];
    return typeof inner === 'string' ? inner.trim() || null : null;
  }
  return null;
}

export function extractInlineRationaleText(
  metaJson: DRepVote['meta_json'] | null | undefined,
): string | null {
  if (!metaJson) return null;

  const body = metaJson.body;
  if (body && typeof body === 'object') {
    for (const key of ['comment', 'rationale', 'motivation']) {
      const extracted = extractStructuredText(body[key]);
      if (extracted) return extracted;
    }
  }

  for (const key of ['rationale', 'motivation']) {
    const extracted = extractStructuredText(metaJson[key]);
    if (extracted) return extracted;
  }

  return null;
}

export function hasRationaleSignal(vote: VoteRationaleSignal): boolean {
  if (typeof vote.has_rationale === 'boolean') return vote.has_rationale;
  return vote.meta_url !== null || extractInlineRationaleText(vote.meta_json) !== null;
}

function isLaterVote(
  candidate: Pick<DRepVote, 'block_time' | 'vote_tx_hash'>,
  current: Pick<DRepVote, 'block_time' | 'vote_tx_hash'>,
): boolean {
  if (candidate.block_time !== current.block_time) {
    return candidate.block_time > current.block_time;
  }
  return candidate.vote_tx_hash > current.vote_tx_hash;
}

export function dedupeLatestVotesByProposal<
  T extends Pick<DRepVote, 'proposal_tx_hash' | 'proposal_index' | 'block_time' | 'vote_tx_hash'>,
>(votes: T[]): T[] {
  const latestByProposal = new Map<string, T>();

  for (const vote of votes) {
    const key = `${vote.proposal_tx_hash}-${vote.proposal_index}`;
    const current = latestByProposal.get(key);
    if (!current || isLaterVote(vote, current)) {
      latestByProposal.set(key, vote);
    }
  }

  return [...latestByProposal.values()].sort((a, b) => {
    if (a.block_time !== b.block_time) return b.block_time - a.block_time;
    return b.vote_tx_hash.localeCompare(a.vote_tx_hash);
  });
}

export function normalizeVoteMapForStorage(
  votesMap: Record<string, DRepVote[]>,
  deriveEpochNo: (vote: DRepVote) => number | null,
  nowIso: string = new Date().toISOString(),
): {
  voteRows: StoredDRepVoteRow[];
  rationaleRows: StoredVoteRationaleRow[];
  maxBlockTime: number | null;
} {
  const voteRows: StoredDRepVoteRow[] = [];
  const rationaleRows: StoredVoteRationaleRow[] = [];
  let maxBlockTime: number | null = null;

  for (const [drepId, votes] of Object.entries(votesMap)) {
    for (const vote of votes) {
      const hasRationale = hasRationaleSignal(vote);
      voteRows.push({
        vote_tx_hash: vote.vote_tx_hash,
        drep_id: drepId,
        proposal_tx_hash: vote.proposal_tx_hash,
        proposal_index: vote.proposal_index,
        vote: vote.vote,
        epoch_no: vote.epoch_no ?? deriveEpochNo(vote),
        block_time: vote.block_time,
        meta_url: vote.meta_url,
        meta_hash: vote.meta_hash,
        has_rationale: hasRationale,
      });

      const inlineRationale = extractInlineRationaleText(vote.meta_json);
      if (inlineRationale) {
        rationaleRows.push({
          vote_tx_hash: vote.vote_tx_hash,
          drep_id: drepId,
          proposal_tx_hash: vote.proposal_tx_hash,
          proposal_index: vote.proposal_index,
          meta_url: vote.meta_url,
          rationale_text: inlineRationale,
          fetched_at: nowIso,
          fetch_status: RATIONALE_FETCH_STATUS.inline,
          fetch_attempts: 0,
          fetch_last_attempted_at: null,
          fetch_last_error: null,
          next_fetch_at: null,
        });
      } else if (vote.meta_url) {
        rationaleRows.push({
          vote_tx_hash: vote.vote_tx_hash,
          drep_id: drepId,
          proposal_tx_hash: vote.proposal_tx_hash,
          proposal_index: vote.proposal_index,
          meta_url: vote.meta_url,
          rationale_text: null,
          fetched_at: null,
          fetch_status: RATIONALE_FETCH_STATUS.pending,
          fetch_attempts: 0,
          fetch_last_attempted_at: null,
          fetch_last_error: null,
          next_fetch_at: nowIso,
        });
      }

      if (maxBlockTime === null || vote.block_time > maxBlockTime) {
        maxBlockTime = vote.block_time;
      }
    }
  }

  return { voteRows, rationaleRows, maxBlockTime };
}

function getProposalImportanceWeight(ctx: ProposalContext): number {
  if (CRITICAL_PROPOSAL_TYPES.includes(ctx.proposalType)) return 3;
  if (ctx.proposalType === 'ParameterChange') return 2;
  if (
    ctx.proposalType === 'TreasuryWithdrawals' &&
    (ctx.treasuryTier === 'significant' || ctx.treasuryTier === 'major')
  ) {
    return 2;
  }
  return 1;
}

export function calculateWeightedRationaleProvisionRate(
  votes: WeightedVoteRationaleSignal[],
  proposalMap: Map<string, ProposalContext>,
): number {
  if (votes.length === 0) return 0;

  let weightedRationale = 0;
  let totalWeight = 0;

  for (const vote of votes) {
    const key = `${vote.proposal_tx_hash}-${vote.proposal_index}`;
    const ctx = proposalMap.get(key);

    if (ctx && RATIONALE_EXEMPT_TYPES.includes(ctx.proposalType)) {
      continue;
    }

    const weight = ctx ? getProposalImportanceWeight(ctx) : 1;
    totalWeight += weight;
    if (hasRationaleSignal(vote)) {
      weightedRationale += weight;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedRationale / totalWeight) * 100);
}

interface CachedVoteSelectRow {
  drep_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  vote_tx_hash: string;
  block_time: number;
  vote: DRepVote['vote'];
  meta_url: string | null;
  meta_hash: string | null;
  epoch_no: number | null;
  has_rationale: boolean;
}

function toCachedVote(row: CachedVoteSelectRow): DRepVote {
  return {
    proposal_tx_hash: row.proposal_tx_hash,
    proposal_index: row.proposal_index,
    vote_tx_hash: row.vote_tx_hash,
    block_time: row.block_time,
    vote: row.vote,
    meta_url: row.meta_url,
    meta_hash: row.meta_hash,
    meta_json: null,
    epoch_no: row.epoch_no ?? undefined,
    has_rationale: row.has_rationale,
  };
}

export async function loadCachedDRepVotes(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<{
  allVotesByDRep: Record<string, DRepVote[]>;
  latestVotesByDRep: Record<string, DRepVote[]>;
  maxBlockTime: number | null;
}> {
  const rows = await fetchAll(
    supabase
      .from('drep_votes')
      .select(
        'drep_id, proposal_tx_hash, proposal_index, vote_tx_hash, block_time, vote, meta_url, meta_hash, epoch_no, has_rationale',
      )
      .order('block_time', { ascending: false }),
  );

  const allVotesByDRep: Record<string, DRepVote[]> = {};
  let maxBlockTime: number | null = null;

  for (const row of rows as CachedVoteSelectRow[]) {
    if (!allVotesByDRep[row.drep_id]) allVotesByDRep[row.drep_id] = [];
    allVotesByDRep[row.drep_id].push(toCachedVote(row));
    if (maxBlockTime === null || row.block_time > maxBlockTime) {
      maxBlockTime = row.block_time;
    }
  }

  const latestVotesByDRep = Object.fromEntries(
    Object.entries(allVotesByDRep).map(([drepId, votes]) => [
      drepId,
      dedupeLatestVotesByProposal(votes),
    ]),
  );

  return {
    allVotesByDRep,
    latestVotesByDRep,
    maxBlockTime,
  };
}
