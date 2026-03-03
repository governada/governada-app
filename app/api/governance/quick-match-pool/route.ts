import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';

export const dynamic = 'force-dynamic';

const DIMENSIONS = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
] as const;

const ANSWER_VECTORS: Record<string, Record<string, Record<string, number>>> = {
  treasury: {
    conservative: {
      treasuryConservative: 80,
      treasuryGrowth: 20,
      decentralization: 50,
      security: 50,
      innovation: 30,
      transparency: 50,
    },
    growth: {
      treasuryConservative: 20,
      treasuryGrowth: 80,
      decentralization: 50,
      security: 50,
      innovation: 70,
      transparency: 50,
    },
    balanced: {
      treasuryConservative: 50,
      treasuryGrowth: 50,
      decentralization: 50,
      security: 50,
      innovation: 50,
      transparency: 50,
    },
  },
  protocol: {
    caution: {
      treasuryConservative: 50,
      treasuryGrowth: 50,
      decentralization: 60,
      security: 70,
      innovation: 30,
      transparency: 50,
    },
    innovation: {
      treasuryConservative: 50,
      treasuryGrowth: 50,
      decentralization: 40,
      security: 30,
      innovation: 80,
      transparency: 50,
    },
    case_by_case: {
      treasuryConservative: 50,
      treasuryGrowth: 50,
      decentralization: 50,
      security: 50,
      innovation: 50,
      transparency: 50,
    },
  },
  transparency: {
    essential: {
      treasuryConservative: 50,
      treasuryGrowth: 50,
      decentralization: 50,
      security: 50,
      innovation: 50,
      transparency: 90,
    },
    nice_to_have: {
      treasuryConservative: 50,
      treasuryGrowth: 50,
      decentralization: 50,
      security: 50,
      innovation: 50,
      transparency: 60,
    },
    doesnt_matter: {
      treasuryConservative: 50,
      treasuryGrowth: 50,
      decentralization: 50,
      security: 50,
      innovation: 50,
      transparency: 50,
    },
  },
};

function toVector(
  t: Record<string, number>,
  p: Record<string, number>,
  tr: Record<string, number>,
): number[] {
  return DIMENSIONS.map((dim) => {
    const v1 = t[dim] ?? 50;
    const v2 = p[dim] ?? 50;
    const v3 = tr[dim] ?? 50;
    return (v1 + v2 + v3) / 3;
  });
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function similarityToScore(sim: number): number {
  return Math.max(0, Math.min(100, Math.round(sim * 100)));
}

export async function POST(request: NextRequest) {
  let body: { treasury?: string; protocol?: string; transparency?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { treasury, protocol, transparency } = body;

  if (!treasury || !ANSWER_VECTORS.treasury[treasury]) {
    return NextResponse.json({ error: 'Invalid treasury answer' }, { status: 400 });
  }
  if (!protocol || !ANSWER_VECTORS.protocol[protocol]) {
    return NextResponse.json({ error: 'Invalid protocol answer' }, { status: 400 });
  }
  if (!transparency || !ANSWER_VECTORS.transparency[transparency]) {
    return NextResponse.json({ error: 'Invalid transparency answer' }, { status: 400 });
  }

  const userVec = toVector(
    ANSWER_VECTORS.treasury[treasury],
    ANSWER_VECTORS.protocol[protocol],
    ANSWER_VECTORS.transparency[transparency],
  );

  const supabase = createClient();

  const { data: maxEpoch } = await supabase
    .from('spo_alignment_snapshots')
    .select('epoch_no')
    .order('epoch_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  const epoch = maxEpoch?.epoch_no ?? 0;
  if (epoch === 0) {
    return NextResponse.json({ matches: [] });
  }

  const { data: alignments } = await supabase
    .from('spo_alignment_snapshots')
    .select(
      'pool_id, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
    )
    .eq('epoch_no', epoch)
    .not('alignment_treasury_conservative', 'is', null);

  if (!alignments?.length) {
    return NextResponse.json({ matches: [] });
  }

  const { data: scores } = await supabase
    .from('spo_score_snapshots')
    .select('pool_id, governance_score, vote_count')
    .eq('epoch_no', epoch);

  const scoreMap = new Map(
    (scores ?? []).map((s) => [
      s.pool_id,
      {
        governanceScore: Number(s.governance_score) ?? 0,
        voteCount: Number(s.vote_count) ?? 0,
      },
    ]),
  );

  const ranked = alignments
    .map((row) => {
      const poolVec = DIMENSIONS.map((_, i) => {
        const col = [
          row.alignment_treasury_conservative,
          row.alignment_treasury_growth,
          row.alignment_decentralization,
          row.alignment_security,
          row.alignment_innovation,
          row.alignment_transparency,
        ][i];
        return Number(col) ?? 50;
      });
      const sim = cosineSimilarity(userVec, poolVec);
      const info = scoreMap.get(row.pool_id) ?? {
        governanceScore: 0,
        voteCount: 0,
      };
      return {
        poolId: row.pool_id,
        poolName: null,
        governanceScore: info.governanceScore,
        matchScore: similarityToScore(sim),
        voteCount: info.voteCount,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);

  captureServerEvent('quick_match_pool_completed', {
    treasury,
    protocol,
    transparency,
    top_match_score: ranked[0]?.matchScore ?? null,
    matches_count: ranked.length,
  });

  return NextResponse.json({
    matches: ranked.map((r) => ({
      poolId: r.poolId,
      poolName: r.poolName,
      governanceScore: r.governanceScore,
      matchScore: r.matchScore,
      voteCount: r.voteCount,
    })),
  });
}
