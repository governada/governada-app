/**
 * DRep Governance Inbox API
 * Returns open proposals the DRep hasn't voted on, with score impact simulation.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDRepById,
  getOpenProposalsForDRep,
  getActualProposalCount,
  getVotedThisEpoch,
} from '@/lib/data';
import { blockTimeToEpoch } from '@/lib/koios';
import { calculateParticipationRate, applyRationaleCurve } from '@/utils/scoring';
import { getProposalPriority } from '@/utils/proposalPriority';
import { captureServerEvent } from '@/lib/posthog-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }

  try {
    const [drep, pendingProposals, totalProposalCount] = await Promise.all([
      getDRepById(drepId),
      getOpenProposalsForDRep(drepId),
      getActualProposalCount(),
    ]);

    if (!drep) {
      return NextResponse.json({ error: 'DRep not found' }, { status: 404 });
    }

    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
    const votedThisEpochCount = await getVotedThisEpoch(drepId, currentEpoch);

    // Score impact simulation: what if DRep votes on ALL pending with rationale?
    const currentVotes = drep.totalVotes;
    const pendingCount = pendingProposals.length;

    // Simulate new participation rate
    const simParticipation = calculateParticipationRate(
      currentVotes + pendingCount,
      totalProposalCount,
    );
    const simEffParticipation = Math.round(simParticipation * drep.deliberationModifier);

    // Simulate rationale rate (assume all new votes have rationale)
    const currentVotesWithRationale = Math.round((drep.rationaleRate / 100) * currentVotes);
    const simRationaleRateRaw =
      currentVotes + pendingCount > 0
        ? Math.round(
            ((currentVotesWithRationale + pendingCount) / (currentVotes + pendingCount)) * 100,
          )
        : 0;
    const simRationaleCurved = applyRationaleCurve(simRationaleRateRaw);

    // Current score pillars (weighted)
    const currentCurvedRationale = applyRationaleCurve(drep.rationaleRate);
    const currentWeightedScore = Math.round(
      drep.effectiveParticipation * 0.3 +
        currentCurvedRationale * 0.35 +
        drep.reliabilityScore * 0.2 +
        drep.profileCompleteness * 0.15,
    );

    // Simulated score (reliability and profile stay the same)
    const simWeightedScore = Math.round(
      simEffParticipation * 0.3 +
        simRationaleCurved * 0.35 +
        drep.reliabilityScore * 0.2 +
        drep.profileCompleteness * 0.15,
    );

    const scoreImpact = simWeightedScore - currentWeightedScore;

    // Per-proposal score impact (approximate: evenly distribute total gain)
    const perProposalImpact =
      pendingCount > 0 ? Math.max(0, +(scoreImpact / pendingCount).toFixed(1)) : 0;

    // Enrich proposals with priority and deadline from Koios expiration_epoch.
    // Falls back to proposed_epoch + 6 (current govActionLifetime) only if
    // expiration_epoch is not yet populated (before next sync).
    const enriched = pendingProposals.map((p) => {
      const expirationEpoch =
        p.expirationEpoch ?? (p.proposedEpoch != null ? p.proposedEpoch + 6 : null);
      return {
        ...p,
        priority: getProposalPriority(p.proposalType),
        expirationEpoch,
        epochsRemaining:
          expirationEpoch != null ? Math.max(0, expirationEpoch - currentEpoch) : null,
        perProposalScoreImpact: perProposalImpact,
      };
    });

    // Sort: critical first, then by deadline (closest first)
    const priorityOrder = { critical: 0, important: 1, standard: 2 };
    enriched.sort((a, b) => {
      if (a.priority !== b.priority) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      const aRemaining = a.epochsRemaining ?? 999;
      const bRemaining = b.epochsRemaining ?? 999;
      return aRemaining - bRemaining;
    });

    const criticalCount = enriched.filter((p) => p.priority === 'critical').length;
    const urgentCount = enriched.filter((p) => (p.epochsRemaining ?? 999) <= 2).length;

    captureServerEvent(
      'inbox_api_served',
      {
        drepId,
        pendingCount: enriched.length,
        criticalCount,
        urgentCount,
        potentialGain: Math.max(0, scoreImpact),
        currentEpoch,
      },
      drepId,
    );

    return NextResponse.json({
      pendingProposals: enriched,
      pendingCount: enriched.length,
      votedThisEpoch: votedThisEpochCount,
      currentEpoch,
      scoreImpact: {
        currentScore: drep.drepScore,
        simulatedScore: Math.min(100, drep.drepScore + scoreImpact),
        potentialGain: Math.max(0, scoreImpact),
        perProposalGain: perProposalImpact,
      },
      criticalCount,
      urgentCount,
    });
  } catch (error) {
    console.error('[Inbox API] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
