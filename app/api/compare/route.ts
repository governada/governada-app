/**
 * DRep Comparison API
 * Returns side-by-side data for 2-3 DReps: profiles, scores, vote overlap, alignment.
 *
 * GET /api/compare?dreps=id1,id2,id3&prefs=key1,key2
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import {
  getDRepById,
  getVotesByDRepId,
  getScoreHistory,
  getProposalsByIds,
  getRationalesByVoteTxHashes,
  type DRepVoteRow,
  type ScoreSnapshot,
} from '@/lib/data';
import { computeOverallAlignment, getPrecomputedBreakdown } from '@/lib/alignment';
import type { EnrichedDRep } from '@/lib/koios';
import type { UserPrefKey } from '@/types/drep';

export const dynamic = 'force-dynamic';

interface CompareProfile {
  drepId: string;
  name: string | null;
  ticker: string | null;
  isActive: boolean;
  sizeTier: string;
  votingPower: number;
  delegatorCount: number;
  drepScore: number;
  pillars: {
    effectiveParticipation: number;
    rationaleRate: number;
    reliabilityScore: number;
    profileCompleteness: number;
  };
}

interface DisagreementDetail {
  txHash: string;
  proposalIndex: number;
  title: string | null;
  proposalType: string | null;
  blockTime: number;
  votes: Record<string, 'Yes' | 'No' | 'Abstain'>;
  rationales: Record<string, string | null>;
}

interface PairwiseOverlap {
  pair: [string, string];
  sharedVotes: number;
  agreedCount: number;
  agreedPct: number;
  disagreements: DisagreementDetail[];
  abstentionGaps: { drepId: string; count: number }[];
}

interface AlignmentResult {
  overall: number;
  breakdown: { key: string; label: string; score: number }[];
}

function buildProfile(drep: EnrichedDRep): CompareProfile {
  return {
    drepId: drep.drepId,
    name: drep.name,
    ticker: drep.ticker,
    isActive: drep.isActive,
    sizeTier: drep.sizeTier,
    votingPower: drep.votingPower,
    delegatorCount: drep.delegatorCount,
    drepScore: drep.drepScore,
    pillars: {
      effectiveParticipation: drep.effectiveParticipation,
      rationaleRate: drep.rationaleRate,
      reliabilityScore: drep.reliabilityScore,
      profileCompleteness: drep.profileCompleteness,
    },
  };
}

function computePairwiseOverlap(
  idA: string,
  idB: string,
  votesA: DRepVoteRow[],
  votesB: DRepVoteRow[],
): Omit<PairwiseOverlap, 'disagreements'> & {
  disagreementKeys: {
    txHash: string;
    proposalIndex: number;
    blockTime: number;
    voteA: string;
    voteB: string;
  }[];
} {
  const mapA = new Map<string, DRepVoteRow>();
  for (const v of votesA) mapA.set(`${v.proposal_tx_hash}-${v.proposal_index}`, v);

  const mapB = new Map<string, DRepVoteRow>();
  for (const v of votesB) mapB.set(`${v.proposal_tx_hash}-${v.proposal_index}`, v);

  let agreed = 0;
  let shared = 0;
  const disagreementKeys: {
    txHash: string;
    proposalIndex: number;
    blockTime: number;
    voteA: string;
    voteB: string;
  }[] = [];
  const abstentionGapsA: string[] = [];
  const abstentionGapsB: string[] = [];

  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
  for (const key of allKeys) {
    const a = mapA.get(key);
    const b = mapB.get(key);

    if (a && b) {
      shared++;
      if (a.vote === b.vote) {
        agreed++;
      } else {
        disagreementKeys.push({
          txHash: a.proposal_tx_hash,
          proposalIndex: a.proposal_index,
          blockTime: Math.max(a.block_time, b.block_time),
          voteA: a.vote,
          voteB: b.vote,
        });
      }
    } else if (a && !b) {
      abstentionGapsB.push(key);
    } else if (!a && b) {
      abstentionGapsA.push(key);
    }
  }

  disagreementKeys.sort((a, b) => b.blockTime - a.blockTime);

  return {
    pair: [idA, idB],
    sharedVotes: shared,
    agreedCount: agreed,
    agreedPct: shared > 0 ? Math.round((agreed / shared) * 100) : 0,
    disagreementKeys,
    abstentionGaps: [
      { drepId: idA, count: abstentionGapsA.length },
      { drepId: idB, count: abstentionGapsB.length },
    ],
  };
}

export const GET = withRouteHandler(async (request, { requestId }) => {
  const drepsParam = request.nextUrl.searchParams.get('dreps');
  const prefsParam = request.nextUrl.searchParams.get('prefs');

  if (!drepsParam) {
    return NextResponse.json({ error: 'Missing dreps parameter' }, { status: 400 });
  }

  const drepIds = drepsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (drepIds.length < 2 || drepIds.length > 3) {
    return NextResponse.json({ error: 'Provide 2-3 DRep IDs' }, { status: 400 });
  }

  const dreps = await Promise.all(drepIds.map((id) => getDRepById(id)));
  const missing = drepIds.filter((_, i) => !dreps[i]);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `DRep(s) not found: ${missing.join(', ')}` },
      { status: 404 },
    );
  }
  const validDreps = dreps as EnrichedDRep[];

  const [allVotes, allHistory] = await Promise.all([
    Promise.all(drepIds.map((id) => getVotesByDRepId(id))),
    Promise.all(drepIds.map((id) => getScoreHistory(id))),
  ]);

  const profiles = validDreps.map(buildProfile);
  const scoreHistory: Record<string, ScoreSnapshot[]> = {};
  drepIds.forEach((id, i) => {
    scoreHistory[id] = allHistory[i];
  });

  const pairs: [number, number][] = [];
  for (let i = 0; i < drepIds.length; i++) {
    for (let j = i + 1; j < drepIds.length; j++) {
      pairs.push([i, j]);
    }
  }

  const rawOverlaps = pairs.map(([i, j]) =>
    computePairwiseOverlap(drepIds[i], drepIds[j], allVotes[i], allVotes[j]),
  );

  const allDisagreementProposalIds = rawOverlaps.flatMap((o) =>
    o.disagreementKeys.map((d) => ({ txHash: d.txHash, index: d.proposalIndex })),
  );
  const uniqueProposalIds = [
    ...new Map(allDisagreementProposalIds.map((p) => [`${p.txHash}-${p.index}`, p])).values(),
  ];

  const allDisagreementVoteTxHashes = new Set<string>();
  for (const overlap of rawOverlaps) {
    const [idA, idB] = overlap.pair;
    const mapA = new Map<string, DRepVoteRow>();
    const mapB = new Map<string, DRepVoteRow>();
    for (const v of allVotes[drepIds.indexOf(idA)])
      mapA.set(`${v.proposal_tx_hash}-${v.proposal_index}`, v);
    for (const v of allVotes[drepIds.indexOf(idB)])
      mapB.set(`${v.proposal_tx_hash}-${v.proposal_index}`, v);
    for (const d of overlap.disagreementKeys) {
      const key = `${d.txHash}-${d.proposalIndex}`;
      const a = mapA.get(key);
      const b = mapB.get(key);
      if (a?.vote_tx_hash) allDisagreementVoteTxHashes.add(a.vote_tx_hash);
      if (b?.vote_tx_hash) allDisagreementVoteTxHashes.add(b.vote_tx_hash);
    }
  }

  const [proposalMap, rationaleMap] = await Promise.all([
    uniqueProposalIds.length > 0 ? getProposalsByIds(uniqueProposalIds) : new Map(),
    allDisagreementVoteTxHashes.size > 0
      ? getRationalesByVoteTxHashes([...allDisagreementVoteTxHashes])
      : new Map(),
  ]);

  const voteOverlap: PairwiseOverlap[] = rawOverlaps.map((raw) => {
    const [idA, idB] = raw.pair;
    const votesForA = allVotes[drepIds.indexOf(idA)];
    const votesForB = allVotes[drepIds.indexOf(idB)];
    const mapA = new Map<string, DRepVoteRow>();
    const mapB = new Map<string, DRepVoteRow>();
    for (const v of votesForA) mapA.set(`${v.proposal_tx_hash}-${v.proposal_index}`, v);
    for (const v of votesForB) mapB.set(`${v.proposal_tx_hash}-${v.proposal_index}`, v);

    const disagreements: DisagreementDetail[] = raw.disagreementKeys.map((d) => {
      const key = `${d.txHash}-${d.proposalIndex}`;
      const proposal = proposalMap.get(key);
      const a = mapA.get(key);
      const b = mapB.get(key);
      const ratA = a?.vote_tx_hash ? rationaleMap.get(a.vote_tx_hash) : undefined;
      const ratB = b?.vote_tx_hash ? rationaleMap.get(b.vote_tx_hash) : undefined;

      return {
        txHash: d.txHash,
        proposalIndex: d.proposalIndex,
        title: proposal?.title || null,
        proposalType: proposal?.proposalType || null,
        blockTime: d.blockTime,
        votes: {
          [idA]: d.voteA as 'Yes' | 'No' | 'Abstain',
          [idB]: d.voteB as 'Yes' | 'No' | 'Abstain',
        },
        rationales: {
          [idA]: ratA?.rationaleAiSummary || ratA?.rationaleText?.slice(0, 200) || null,
          [idB]: ratB?.rationaleAiSummary || ratB?.rationaleText?.slice(0, 200) || null,
        },
      };
    });

    return {
      pair: raw.pair,
      sharedVotes: raw.sharedVotes,
      agreedCount: raw.agreedCount,
      agreedPct: raw.agreedPct,
      disagreements,
      abstentionGaps: raw.abstentionGaps,
    };
  });

  let alignment: Record<string, AlignmentResult> | null = null;
  if (prefsParam) {
    const prefs = prefsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) as UserPrefKey[];
    if (prefs.length > 0) {
      const categoryLabels: Record<string, string> = {
        treasury: 'Treasury',
        decentralization: 'Decentralization',
        security: 'Security',
        innovation: 'Innovation',
        transparency: 'Transparency',
      };
      alignment = {};
      for (const drep of validDreps) {
        const overall = computeOverallAlignment(drep, prefs);
        const bd = getPrecomputedBreakdown(drep, prefs);
        const breakdown = Object.entries(categoryLabels).map(([key, label]) => ({
          key,
          label,
          score: bd[key as keyof typeof bd] as number,
        }));
        alignment[drep.drepId] = { overall, breakdown };
      }
    }
  }

  return NextResponse.json({
    dreps: profiles,
    scoreHistory,
    voteOverlap,
    alignment,
  });
});
