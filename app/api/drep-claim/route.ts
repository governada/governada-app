import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { DrepClaimSchema } from '@/lib/api/schemas/drep';

/**
 * GET: Check if a DRep is claimed by any user.
 * Returns { claimed: boolean }.
 */
export async function GET(request: NextRequest) {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('claimed_drep_id', drepId)
      .limit(1);

    if (error) {
      logger.error('Check error', { context: 'drepclaim', error: error?.message });
      return NextResponse.json({ claimed: false });
    }

    return NextResponse.json({ claimed: (data?.length ?? 0) > 0 });
  } catch {
    return NextResponse.json({ claimed: false });
  }
}

/**
 * POST: Auto-claim a DRep profile when an authenticated wallet matches the DRep ID.
 */
export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const { sessionToken, drepId } = DrepClaimSchema.parse(await request.json());

    const parsed = await validateSessionToken(sessionToken);
    if (!parsed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = parsed;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('users')
      .update({ claimed_drep_id: drepId })
      .eq('id', userId);

    if (error) {
      logger.error('Error', { context: 'drepclaim', error: error?.message });
      return NextResponse.json({ error: 'Failed to claim' }, { status: 500 });
    }

    captureServerEvent('drep_claimed', { drep_id: drepId }, userId);
    return NextResponse.json({ claimed: true, drepId });
  },
  { auth: 'none', rateLimit: { max: 5, window: 60 } },
);
