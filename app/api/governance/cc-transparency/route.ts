import { NextRequest, NextResponse } from 'next/server';
import { getCCMembersTransparency, getCCTransparencyHistory } from '@/lib/data';

export const dynamic = 'force-dynamic';

/**
 * GET /api/governance/cc-transparency
 *
 * Returns CC Transparency Index data.
 * Query params:
 *   - ccHotId: (optional) If provided, returns history for a single member.
 *   - Otherwise returns all members with their current transparency scores.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const ccHotId = searchParams.get('ccHotId');

  if (ccHotId) {
    const history = await getCCTransparencyHistory(ccHotId);
    return NextResponse.json({ history });
  }

  const members = await getCCMembersTransparency();
  return NextResponse.json({ members });
}
