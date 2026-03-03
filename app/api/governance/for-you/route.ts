import { NextResponse, NextRequest } from 'next/server';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { createClient } from '@/lib/supabase';
import { cosineSimilarity } from '@/lib/representationMatch';
import type { AlignmentDimension, AlignmentScores } from '@/lib/drepIdentity';
import { captureServerEvent } from '@/lib/posthog-server';

export const dynamic = 'force-dynamic';

const DIMENSIONS: AlignmentDimension[] = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
];

const DIM_LABELS: Record<AlignmentDimension, string> = {
  treasuryConservative: 'treasury conservative',
  treasuryGrowth: 'treasury growth',
  decentralization: 'decentralization',
  security: 'security',
  innovation: 'innovation',
  transparency: 'transparency',
};

const DIM_DB: Record<AlignmentDimension, string> = {
  treasuryConservative: 'dim_treasury_conservative',
  treasuryGrowth: 'dim_treasury_growth',
  decentralization: 'dim_decentralization',
  security: 'dim_security',
  innovation: 'dim_innovation',
  transparency: 'dim_transparency',
};

function userVectorFromScores(scores: AlignmentScores): number[] {
  return DIMENSIONS.map((d) => {
    const v = scores[d];
    return v != null ? v / 100 : 0.5;
  });
}

function proposalVectorFromRow(row: Record<string, number | null>): number[] {
  return DIMENSIONS.map((d) => Number(row[DIM_DB[d]]) || 0);
}

function deriveAlignmentsFromVotes(
  pollVotes: { proposal_tx_hash: string; proposal_index: number; vote: string }[],
  classifications: Map<string, Record<AlignmentDimension, number>>,
): AlignmentScores {
  const sums: Record<AlignmentDimension, number> = {} as Record<AlignmentDimension, number>;
  const weights: Record<AlignmentDimension, number> = {} as Record<AlignmentDimension, number>;
  for (const d of DIMENSIONS) {
    sums[d] = 0;
    weights[d] = 0;
  }

  for (const pv of pollVotes) {
    const key = `${pv.proposal_tx_hash}-${pv.proposal_index}`;
    const cls = classifications.get(key);
    if (!cls) continue;

    const voteVal = pv.vote.toLowerCase() === 'yes' ? 1 : pv.vote.toLowerCase() === 'no' ? -1 : 0;

    for (const d of DIMENSIONS) {
      const rel = cls[d] ?? 0;
      if (rel <= 0) continue;
      sums[d] += voteVal * rel;
      weights[d] += rel;
    }
  }

  const scores: AlignmentScores = {} as AlignmentScores;
  for (const d of DIMENSIONS) {
    if (weights[d] > 0) {
      const raw = sums[d] / weights[d];
      scores[d] = Math.round(((raw + 1) / 2) * 100);
    } else {
      scores[d] = null;
    }
  }
  return scores;
}

function topAligningDimension(
  userVec: number[],
  propVec: number[],
): { dim: AlignmentDimension; strength: number } | null {
  let best: AlignmentDimension | null = null;
  let bestStrength = 0;

  for (let i = 0; i < DIMENSIONS.length; i++) {
    const u = userVec[i] ?? 0.5;
    const p = propVec[i] ?? 0;
    if (p <= 0) continue;
    const strength = u * p;
    if (strength > bestStrength) {
      bestStrength = strength;
      best = DIMENSIONS[i];
    }
  }
  return best ? { dim: best, strength: bestStrength } : null;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const session = await validateSessionToken(token);
  if (!session?.walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();
  const walletAddress = session.walletAddress;

  try {
    const [profileResult, pollResult] = await Promise.all([
      supabase
        .from('user_governance_profiles')
        .select('alignment_scores')
        .eq('wallet_address', walletAddress)
        .single(),
      supabase
        .from('poll_responses')
        .select('proposal_tx_hash, proposal_index, vote')
        .eq('wallet_address', walletAddress),
    ]);

    let userVec: number[];
    let profileSource: 'quiz' | 'votes' | 'none' = 'none';

    const alignmentScores = profileResult.data?.alignment_scores as AlignmentScores | null;
    if (alignmentScores && Object.values(alignmentScores).some((v) => v != null)) {
      userVec = userVectorFromScores(alignmentScores);
      profileSource = 'quiz';
    } else if (pollResult.data && pollResult.data.length > 0) {
      const proposalTxHashes = [...new Set(pollResult.data.map((v) => v.proposal_tx_hash))];
      const { data: classifications } = await supabase
        .from('proposal_classifications')
        .select(
          'proposal_tx_hash, proposal_index, dim_treasury_conservative, dim_treasury_growth, dim_decentralization, dim_security, dim_innovation, dim_transparency',
        )
        .in('proposal_tx_hash', proposalTxHashes);

      const classMap = new Map<string, Record<AlignmentDimension, number>>();
      if (classifications) {
        for (const c of classifications) {
          const key = `${c.proposal_tx_hash}-${c.proposal_index}`;
          classMap.set(key, {
            treasuryConservative: Number(c.dim_treasury_conservative) || 0,
            treasuryGrowth: Number(c.dim_treasury_growth) || 0,
            decentralization: Number(c.dim_decentralization) || 0,
            security: Number(c.dim_security) || 0,
            innovation: Number(c.dim_innovation) || 0,
            transparency: Number(c.dim_transparency) || 0,
          });
        }
      }

      const derived = deriveAlignmentsFromVotes(pollResult.data, classMap);
      if (Object.values(derived).some((v) => v != null)) {
        userVec = userVectorFromScores(derived);
        profileSource = 'votes';
      } else {
        return NextResponse.json({
          recommendations: [],
          profileSource: 'none',
        });
      }
    } else {
      return NextResponse.json({
        recommendations: [],
        profileSource: 'none',
      });
    }

    const { data: activeProposals } = await supabase
      .from('proposals')
      .select('tx_hash, proposal_index, title, proposal_type')
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null)
      .order('block_time', { ascending: false })
      .limit(100);

    if (!activeProposals?.length) {
      return NextResponse.json({
        recommendations: [],
        profileSource,
      });
    }

    const proposalTxHashes = [...new Set(activeProposals.map((p) => p.tx_hash))];
    const { data: classifications } = await supabase
      .from('proposal_classifications')
      .select(
        'proposal_tx_hash, proposal_index, dim_treasury_conservative, dim_treasury_growth, dim_decentralization, dim_security, dim_innovation, dim_transparency',
      )
      .in('proposal_tx_hash', proposalTxHashes);

    const classMap = new Map<string, number[]>();
    if (classifications) {
      for (const c of classifications) {
        const key = `${c.proposal_tx_hash}-${c.proposal_index}`;
        classMap.set(key, proposalVectorFromRow(c as unknown as Record<string, number | null>));
      }
    }

    const scored: Array<{
      txHash: string;
      proposalIndex: number;
      title: string;
      proposalType: string;
      similarity: number;
      propVec: number[];
      conflict: boolean;
    }> = [];

    for (const p of activeProposals) {
      const key = `${p.tx_hash}-${p.proposal_index}`;
      const propVec = classMap.get(key);
      if (!propVec) continue;

      const sim = cosineSimilarity(userVec, propVec);
      const magA = Math.sqrt(userVec.reduce((s, v) => s + v * v, 0));
      const magB = Math.sqrt(propVec.reduce((s, v) => s + v * v, 0));
      if (magA === 0 || magB === 0) continue;

      const relevanceScore = Math.round(((sim + 1) / 2) * 100);
      scored.push({
        txHash: p.tx_hash,
        proposalIndex: p.proposal_index,
        title: p.title || `${p.tx_hash.slice(0, 12)}…`,
        proposalType: p.proposal_type || 'Unknown',
        similarity: sim,
        propVec,
        conflict: sim < 0,
      });
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    const top5 = scored.slice(0, 5);

    const recommendations = top5.map((s) => {
      const relevanceScore = Math.round(((s.similarity + 1) / 2) * 100);
      const topDim = topAligningDimension(userVec, s.propVec);
      const alignmentReason = s.conflict
        ? 'Conflicts with your governance DNA'
        : topDim
          ? `Aligns with your ${DIM_LABELS[topDim.dim]} values`
          : 'Relevant to your governance profile';

      return {
        txHash: s.txHash,
        proposalIndex: s.proposalIndex,
        title: s.title,
        proposalType: s.proposalType,
        relevanceScore,
        alignmentReason,
        conflict: s.conflict,
      };
    });

    captureServerEvent(
      'for_you_recommendations_calculated',
      {
        count: recommendations.length,
        profile_source: profileSource,
        has_conflicts: recommendations.some((r) => r.conflict),
      },
      walletAddress,
    );

    return NextResponse.json({
      recommendations,
      profileSource,
    });
  } catch (error) {
    console.error('[For You API] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
