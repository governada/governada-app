export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { computeDRepScoresForEpoch } from '@/lib/scoring/historical';

/**
 * Temporary diagnostic endpoint to verify backfill EP/GI fix.
 * Calls computeDRepScoresForEpoch(530) and returns pillar breakdowns.
 * DELETE THIS FILE after verification.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const epoch = Number(searchParams.get('epoch') ?? 530);

  try {
    const scores = await computeDRepScoresForEpoch(epoch);

    const epNonZero = scores.filter((s) => s.effectiveParticipationV3 > 0).length;
    const giNonZero = scores.filter((s) => s.governanceIdentity > 0).length;
    const eqNonZero = scores.filter((s) => s.engagementQuality > 0).length;
    const relNonZero = scores.filter((s) => s.reliabilityV3 > 0).length;

    const sample = scores.slice(0, 5).map((s) => ({
      drepId: s.drepId.slice(0, 20) + '...',
      score: s.score,
      ep: s.effectiveParticipationV3,
      epRaw: s.effectiveParticipationV3Raw,
      gi: s.governanceIdentity,
      giRaw: s.governanceIdentityRaw,
      eq: s.engagementQuality,
      rel: s.reliabilityV3,
    }));

    return NextResponse.json({
      epoch,
      totalDreps: scores.length,
      nonZeroCounts: { ep: epNonZero, gi: giNonZero, eq: eqNonZero, rel: relNonZero },
      sample,
      avgScores:
        scores.length > 0
          ? {
              composite: Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length),
              ep: Math.round(
                scores.reduce((s, r) => s + r.effectiveParticipationV3, 0) / scores.length,
              ),
              gi: Math.round(scores.reduce((s, r) => s + r.governanceIdentity, 0) / scores.length),
              eq: Math.round(scores.reduce((s, r) => s + r.engagementQuality, 0) / scores.length),
              rel: Math.round(scores.reduce((s, r) => s + r.reliabilityV3, 0) / scores.length),
            }
          : null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
