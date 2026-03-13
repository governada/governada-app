import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/you/epoch-headline
 *
 * Returns the AI-generated epoch headline from the latest governance brief.
 * Falls back to null if no brief exists (Hub uses its own template logic).
 */
export const GET = withRouteHandler(
  async (_req, { userId }: RouteContext) => {
    const supabase = getSupabaseAdmin();

    const { data: brief } = await supabase
      .from('governance_briefs')
      .select('content_json, epoch')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!brief?.content_json) {
      return NextResponse.json({ headline: null, epoch: null });
    }

    const content = brief.content_json as { headline?: string };

    return NextResponse.json({
      headline: content.headline ?? null,
      epoch: brief.epoch,
    });
  },
  { auth: 'required' },
);
