import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { captureServerEvent } from '@/lib/posthog-server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { ViewSchema } from '@/lib/api/schemas/governance';

export const POST = withRouteHandler(
  async (request: NextRequest, { requestId }: RouteContext) => {
    const body = await request.json();
    const { drepId, sessionToken } = ViewSchema.parse(body);

    let viewerWallet: string | null = null;
    if (sessionToken) {
      const parsed = await validateSessionToken(sessionToken);
      if (parsed) viewerWallet = parsed.walletAddress;
    }

    const supabase = getSupabaseAdmin();
    await supabase.from('profile_views').insert({
      drep_id: drepId,
      viewer_wallet: viewerWallet,
    });

    captureServerEvent(
      'profile_viewed',
      { drep_id: drepId, authenticated: !!viewerWallet },
      viewerWallet || 'anonymous',
    );
    return NextResponse.json({ ok: true });
  },
  { auth: 'none', rateLimit: { max: 60, window: 60 } },
);

export async function GET(request: NextRequest) {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [weekResult, totalResult] = await Promise.all([
      supabase
        .from('profile_views')
        .select('id', { count: 'exact', head: true })
        .eq('drep_id', drepId)
        .gte('viewed_at', weekAgo),
      supabase
        .from('profile_views')
        .select('id', { count: 'exact', head: true })
        .eq('drep_id', drepId),
    ]);

    return NextResponse.json({
      weekViews: weekResult.count ?? 0,
      totalViews: totalResult.count ?? 0,
    });
  } catch (err) {
    const { logger } = await import('@/lib/logger');
    logger.error('Failed to fetch view counts', {
      context: 'views',
      drepId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to fetch view counts' }, { status: 500 });
  }
}
