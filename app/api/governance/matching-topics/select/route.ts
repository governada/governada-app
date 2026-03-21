export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/governance/matching-topics/select
 *
 * Increments the selection_count for a topic when a user taps a pill.
 * Rate limited to 10 requests per IP per hour.
 */
export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const body = (await request.json()) as { slug?: string };
    const slug = body.slug;

    if (!slug || typeof slug !== 'string' || slug.length > 100) {
      return NextResponse.json({ error: 'Missing or invalid slug' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Read current count and increment
    const { data: current } = await supabase
      .from('matching_topics')
      .select('selection_count')
      .eq('slug', slug)
      .eq('enabled', true)
      .single();

    if (!current) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    await supabase
      .from('matching_topics')
      .update({
        selection_count: (current.selection_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('slug', slug);

    return NextResponse.json({ ok: true });
  },
  { rateLimit: { max: 10, window: 3600 } },
);
