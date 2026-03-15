/**
 * DRep Basic Info API — lightweight endpoint for comparison data.
 *
 * GET /api/drep/[drepId]/basic
 *
 * Returns: { drepId, name, score, tier, participationRate }
 * Used by ComparisonStrip to show the viewer's current DRep alongside
 * the DRep being viewed.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getDRepById } from '@/lib/data';
import { getDRepPrimaryName } from '@/utils/display';
import { computeTier } from '@/lib/scoring/tiers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const drepId = request.nextUrl.pathname.split('/api/drep/')[1]?.split('/')[0];
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }

  const drep = await getDRepById(decodeURIComponent(drepId));
  if (!drep) {
    return NextResponse.json({ error: 'DRep not found' }, { status: 404 });
  }

  return NextResponse.json({
    drepId: drep.drepId,
    name: getDRepPrimaryName(drep),
    score: drep.drepScore,
    tier: computeTier(drep.drepScore),
    participationRate: drep.effectiveParticipation ?? 0,
  });
}
