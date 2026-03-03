import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseSessionToken } from '@/lib/supabaseAuth';
import { captureServerEvent } from '@/lib/posthog-server';

/**
 * POST: Record a profile view (non-blocking, fire-and-forget from client)
 */
export async function POST(request: NextRequest) {
  try {
    const { drepId, sessionToken } = await request.json();
    if (!drepId || typeof drepId !== 'string') {
      return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
    }

    let viewerWallet: string | null = null;
    if (sessionToken) {
      const parsed = parseSessionToken(sessionToken);
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
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * GET: Fetch view stats for a DRep (used by dashboard)
 */
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
  } catch {
    return NextResponse.json({ weekViews: 0, totalViews: 0 }, { status: 500 });
  }
}
