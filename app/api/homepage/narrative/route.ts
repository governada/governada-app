import { NextResponse } from 'next/server';
import {
  computeGovernanceState,
  type GovernanceStateResult,
} from '@/lib/intelligence/governance-state';
import { computeGHI, type GHIComputeResult } from '@/lib/ghi';
import { cached } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * GET /api/homepage/narrative
 *
 * Returns a 1-2 sentence governance narrative for the homepage hero.
 * Changes based on current governance state. Cached 5 minutes.
 */
export async function GET() {
  try {
    const result = await cached('homepage:narrative:anonymous', 300, async () => {
      const [govState, ghi] = await Promise.all([computeGovernanceState(), computeGHI()]);

      return {
        narrative: composeNarrative(govState, ghi),
        healthScore: ghi.score,
        urgency: govState.urgency,
      };
    });

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch {
    // Graceful fallback — never break the homepage
    return NextResponse.json(
      {
        narrative: 'Cardano governance is live. Explore the network above.',
        healthScore: 75,
        urgency: 30,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=30' } },
    );
  }
}

function composeNarrative(govState: GovernanceStateResult, ghi: GHIComputeResult): string {
  const { urgency, epoch } = govState;
  const proposalCount = epoch.activeProposalCount;
  const epochDay = Math.ceil(epoch.progress * 5);
  const epochNum = epoch.currentEpoch;

  // Stale data safety: if the low score is caused by sync failure, don't alarm users
  const hasStaleData = ghi.meta?.staleComponents && ghi.meta.staleComponents.length > 0;
  if ((ghi.band === 'fair' || ghi.band === 'critical') && hasStaleData) {
    return `Governance health reads ${ghi.score}/100 but some data sources are temporarily delayed. ${proposalCount > 0 ? `${proposalCount} proposals open in epoch ${epochNum}.` : `Epoch ${epochNum} in progress.`}`;
  }

  // High urgency — governance needs attention
  if (urgency > 70 && proposalCount > 0) {
    return `${proposalCount} proposal${proposalCount > 1 ? 's' : ''} ${proposalCount > 1 ? 'are' : 'is'} being decided right now. Epoch ${epochNum}, day ${epochDay} — governance needs your attention.`;
  }

  // Strong health + active proposals
  if (ghi.band === 'strong' && proposalCount > 0) {
    return `Governance health is strong at ${ghi.score}/100. ${proposalCount} proposal${proposalCount > 1 ? 's' : ''} open for consideration in epoch ${epochNum}.`;
  }

  // Good health
  if (ghi.band === 'good' && proposalCount > 0) {
    return `${proposalCount} proposal${proposalCount > 1 ? 's' : ''} being decided in epoch ${epochNum}. Governance health: ${ghi.score}/100.`;
  }

  // Fair/critical health — surface the issue
  if (ghi.band === 'fair' || ghi.band === 'critical') {
    return `Governance health at ${ghi.score}/100 — participation matters. ${proposalCount > 0 ? `${proposalCount} proposals await votes.` : `Epoch ${epochNum} in progress.`}`;
  }

  // Quiet epoch — no proposals
  if (proposalCount === 0) {
    return `Epoch ${epochNum}, day ${epochDay}. No active proposals — a quiet moment in Cardano governance.`;
  }

  // Default
  return `${proposalCount} proposal${proposalCount > 1 ? 's' : ''} being decided. Explore the governance network above.`;
}
