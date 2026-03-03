/**
 * GET /api/briefs/latest — Returns the most recent governance brief for the authenticated user.
 */
import { NextRequest, NextResponse } from 'next/server';

import { getLatestBrief } from '@/lib/governanceBrief';
import { captureServerEvent } from '@/lib/posthog-server';
import { validateSessionToken } from '@/lib/supabaseAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await validateSessionToken(authHeader.slice(7));
  if (!session?.walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const brief = await getLatestBrief(session.walletAddress);

  if (!brief) {
    return NextResponse.json({ brief: null, message: 'No briefs yet' });
  }

  captureServerEvent(
    'governance_brief_opened',
    {
      brief_id: brief.id,
      source: 'api',
    },
    session.walletAddress,
  );

  return NextResponse.json({ brief });
}
