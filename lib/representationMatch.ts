/**
 * Shared representation matching engine.
 * Dual-path: vote-overlap matching (legacy) + PCA cosine similarity (new).
 */

import { createClient } from '@/lib/supabase';
import { loadActivePCA } from '@/lib/alignment/pca';

function normalizeVote(vote: string): string {
  return vote.charAt(0).toUpperCase() + vote.slice(1).toLowerCase();
}

export interface VoteComparison {
  proposalTxHash: string;
  proposalIndex: number;
  proposalTitle: string | null;
  userVote: string;
  drepVote: string;
  agreed: boolean;
}

export interface RepresentationMatchResult {
  score: number | null;
  aligned: number;
  misaligned: number;
  total: number;
  comparisons: VoteComparison[];
}

/**
 * Calculate how well a single DRep represents a user's voting preferences.
 */
export function calculateRepresentationMatch(
  pollVotes: { proposal_tx_hash: string; proposal_index: number; vote: string }[],
  drepVotes: { proposal_tx_hash: string; proposal_index: number; vote: string }[],
  proposalTitleMap?: Map<string, string | null>,
): RepresentationMatchResult {
  const drepVoteMap = new Map<string, string>();
  for (const v of drepVotes) {
    drepVoteMap.set(`${v.proposal_tx_hash}-${v.proposal_index}`, v.vote);
  }

  const comparisons: VoteComparison[] = [];
  for (const pv of pollVotes) {
    const key = `${pv.proposal_tx_hash}-${pv.proposal_index}`;
    const drepVote = drepVoteMap.get(key);
    if (!drepVote) continue;

    const normalizedUserVote = normalizeVote(pv.vote);
    comparisons.push({
      proposalTxHash: pv.proposal_tx_hash,
      proposalIndex: pv.proposal_index,
      proposalTitle: proposalTitleMap?.get(key) ?? null,
      userVote: normalizedUserVote,
      drepVote,
      agreed: normalizedUserVote === drepVote,
    });
  }

  const aligned = comparisons.filter((c) => c.agreed).length;
  return {
    score: comparisons.length > 0 ? Math.round((aligned / comparisons.length) * 100) : null,
    aligned,
    misaligned: comparisons.length - aligned,
    total: comparisons.length,
    comparisons,
  };
}

export interface DRepMatchSummary {
  drepId: string;
  drepName: string | null;
  drepScore: number;
  matchScore: number;
  agreed: number;
  overlapping: number;
}

/**
 * Find the best-matching DReps for a user based on their poll votes.
 * Queries all DRep votes on proposals the user has voted on, then ranks by match rate.
 */
export async function findBestMatchDReps(
  walletAddress: string,
  opts?: {
    excludeDrepId?: string | null;
    minOverlap?: number;
    minMatchRate?: number;
    limit?: number;
  },
): Promise<{
  matches: DRepMatchSummary[];
  currentDRepMatch: RepresentationMatchResult | null;
}> {
  const supabase = createClient();
  const minOverlap = opts?.minOverlap ?? 2;
  const minMatchRate = opts?.minMatchRate ?? 0;
  const limit = opts?.limit ?? 100;

  // Fetch user's poll votes
  const { data: pollVotes } = await supabase
    .from('poll_responses')
    .select('proposal_tx_hash, proposal_index, vote')
    .eq('wallet_address', walletAddress);

  if (!pollVotes || pollVotes.length === 0) {
    return { matches: [], currentDRepMatch: null };
  }

  const userVoteKeys = [...new Set(pollVotes.map((pv) => pv.proposal_tx_hash))];
  const pollVoteMap = new Map<string, string>();
  for (const pv of pollVotes) {
    pollVoteMap.set(`${pv.proposal_tx_hash}-${pv.proposal_index}`, pv.vote);
  }

  // Fetch all DRep votes on overlapping proposals
  const { data: candidateVotes } = await supabase
    .from('drep_votes')
    .select('drep_id, proposal_tx_hash, proposal_index, vote')
    .in('proposal_tx_hash', userVoteKeys);

  if (!candidateVotes || candidateVotes.length === 0) {
    return { matches: [], currentDRepMatch: null };
  }

  // Aggregate match stats per DRep
  const drepMatchMap = new Map<string, { matched: number; total: number }>();
  for (const cv of candidateVotes) {
    const key = `${cv.proposal_tx_hash}-${cv.proposal_index}`;
    const userVote = pollVoteMap.get(key);
    if (!userVote) continue;

    const entry = drepMatchMap.get(cv.drep_id) || { matched: 0, total: 0 };
    entry.total++;
    if (normalizeVote(userVote) === cv.vote) entry.matched++;
    drepMatchMap.set(cv.drep_id, entry);
  }

  // Calculate current DRep match if specified
  let currentDRepMatch: RepresentationMatchResult | null = null;
  if (opts?.excludeDrepId) {
    const currentStats = drepMatchMap.get(opts.excludeDrepId);
    if (currentStats && currentStats.total > 0) {
      currentDRepMatch = {
        score: Math.round((currentStats.matched / currentStats.total) * 100),
        aligned: currentStats.matched,
        misaligned: currentStats.total - currentStats.matched,
        total: currentStats.total,
        comparisons: [],
      };
    }
  }

  // Filter and sort
  const candidates = [...drepMatchMap.entries()]
    .filter(([id, m]) => {
      if (id === opts?.excludeDrepId) return false;
      if (m.total < minOverlap) return false;
      const rate = m.matched / m.total;
      return rate >= minMatchRate;
    })
    .sort((a, b) => b[1].matched / b[1].total - a[1].matched / a[1].total)
    .slice(0, limit);

  if (candidates.length === 0) {
    return { matches: [], currentDRepMatch };
  }

  // Fetch DRep metadata
  const candidateDrepIds = candidates.map(([id]) => id);
  const { data: drepRows } = await supabase
    .from('dreps')
    .select('id, info, score')
    .in('id', candidateDrepIds);

  const drepInfoMap = new Map<string, { name: string | null; score: number }>();
  if (drepRows) {
    for (const d of drepRows) {
      drepInfoMap.set(d.id, {
        name: ((d.info as Record<string, unknown>)?.name as string) || null,
        score: Number(d.score) || 0,
      });
    }
  }

  const matches: DRepMatchSummary[] = candidates.map(([drepId, match]) => {
    const info = drepInfoMap.get(drepId);
    return {
      drepId,
      drepName: info?.name || null,
      drepScore: info?.score || 0,
      matchScore: Math.round((match.matched / match.total) * 100),
      agreed: match.matched,
      overlapping: match.total,
    };
  });

  return { matches, currentDRepMatch };
}

// ============================================================================
// PCA-BASED MATCHING (cosine similarity in PCA space)
// ============================================================================

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Project a user's partial vote vector into PCA space using active loadings.
 * userVotes: map of proposalId ("txHash-index") → vote value (+1, -1, 0)
 */
export function projectUserVector(
  userVotes: Map<string, number>,
  loadings: number[][],
  proposalIds: string[],
): number[] | null {
  if (userVotes.size === 0) return null;

  const k = loadings.length;
  const coords = new Array<number>(k).fill(0);
  let voteCount = 0;

  for (const [proposalId, voteValue] of userVotes) {
    const idx = proposalIds.indexOf(proposalId);
    if (idx === -1) continue;

    for (let c = 0; c < k; c++) {
      coords[c] += voteValue * loadings[c][idx];
    }
    voteCount++;
  }

  return voteCount > 0 ? coords : null;
}

export interface PCAMatchResult {
  drepId: string;
  similarity: number;
  drepName: string | null;
  drepScore: number;
}

/**
 * Find best-matching DReps using PCA cosine similarity.
 * Used by Quick Match and DNA Quiz.
 */
export async function findPCAMatches(
  userVotes: Map<string, number>,
  opts?: { limit?: number },
): Promise<PCAMatchResult[]> {
  const limit = opts?.limit ?? 20;

  const pca = await loadActivePCA();
  if (!pca) return [];

  const userCoords = projectUserVector(userVotes, pca.loadings, pca.proposalIds);
  if (!userCoords) return [];

  const supabase = createClient();

  const { data: coordRows } = await supabase
    .from('drep_pca_coordinates')
    .select('drep_id, coordinates')
    .eq('run_id', pca.runId);

  if (!coordRows?.length) return [];

  const similarities = coordRows.map((row) => ({
    drepId: row.drep_id as string,
    similarity: cosineSimilarity(userCoords, row.coordinates as number[]),
  }));

  similarities.sort((a, b) => b.similarity - a.similarity);
  const topN = similarities.slice(0, limit);

  // Fetch DRep metadata
  const { data: drepRows } = await supabase
    .from('dreps')
    .select('id, info, score')
    .in(
      'id',
      topN.map((s) => s.drepId),
    );

  const infoMap = new Map<string, { name: string | null; score: number }>();
  if (drepRows) {
    for (const d of drepRows) {
      infoMap.set(d.id, {
        name: ((d.info as Record<string, unknown>)?.name as string) || null,
        score: Number(d.score) || 0,
      });
    }
  }

  return topN.map((s) => {
    const info = infoMap.get(s.drepId);
    return {
      drepId: s.drepId,
      similarity: Math.round(s.similarity * 100),
      drepName: info?.name || null,
      drepScore: info?.score || 0,
    };
  });
}

/**
 * Compute DRep-to-DRep similarity in PCA space.
 */
export async function drepSimilarity(drepIdA: string, drepIdB: string): Promise<number | null> {
  const supabase = createClient();

  const pca = await loadActivePCA();
  if (!pca) return null;

  const { data } = await supabase
    .from('drep_pca_coordinates')
    .select('drep_id, coordinates')
    .eq('run_id', pca.runId)
    .in('drep_id', [drepIdA, drepIdB]);

  if (!data || data.length < 2) return null;

  const coordA = data.find((d) => d.drep_id === drepIdA)?.coordinates as number[] | undefined;
  const coordB = data.find((d) => d.drep_id === drepIdB)?.coordinates as number[] | undefined;

  if (!coordA || !coordB) return null;

  return Math.round(cosineSimilarity(coordA, coordB) * 100);
}
