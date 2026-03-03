/**
 * Governance DNA Matches API
 * Returns match scores for all DReps based on a user's poll vote history.
 * Used by the discovery page to show behavioral match % on cards/table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { findBestMatchDReps } from '@/lib/representationMatch';
import { captureServerEvent } from '@/lib/posthog-server';

export const dynamic = 'force-dynamic';

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

  const excludeDrepId = request.nextUrl.searchParams.get('currentDrepId') || undefined;

  try {
    const { matches, currentDRepMatch } = await findBestMatchDReps(session.walletAddress, {
      excludeDrepId,
      minOverlap: 1,
      minMatchRate: 0,
      limit: 200,
    });

    captureServerEvent(
      'governance_matches_calculated',
      {
        matches_count: matches.length,
        top_match_score: matches[0]?.matchScore ?? null,
        has_current_drep_match: !!currentDRepMatch,
      },
      session.walletAddress,
    );

    return NextResponse.json({
      matches,
      currentDRepMatch: currentDRepMatch
        ? {
            matchScore: currentDRepMatch.score,
            agreed: currentDRepMatch.aligned,
            total: currentDRepMatch.total,
          }
        : null,
    });
  } catch (error) {
    console.error('[Governance Matches API] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
