import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('position_statements')
    .select('id, statement_text, created_at, entity_type, entity_id')
    .eq('entity_type', 'spo')
    .eq('entity_id', poolId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

/**
 * POST /api/spo/[poolId]/statements
 * Creates a position statement for a claimed SPO pool.
 * Requires auth — the requester's wallet must match the pool's claimed_by value.
 */
export const POST = withRouteHandler(
  async (request: NextRequest, { wallet }: RouteContext) => {
    const poolId = decodeURIComponent(request.nextUrl.pathname.split('/')[3]);
    const body = await request.json();
    const { statement_text } = body as { statement_text?: string };

    if (!statement_text?.trim()) {
      return NextResponse.json({ error: 'statement_text is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: pool } = await supabase
      .from('pools')
      .select('claimed_by, claimed_at')
      .eq('pool_id', poolId)
      .single();

    if (!pool?.claimed_by) {
      return NextResponse.json({ error: 'Pool not claimed' }, { status: 403 });
    }

    // Verify the authenticated wallet owns this pool
    if (pool.claimed_by !== wallet) {
      return NextResponse.json({ error: 'Not authorized for this pool' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('position_statements')
      .insert({
        entity_type: 'spo',
        entity_id: poolId,
        statement_text: statement_text.trim(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  },
  { auth: 'required', rateLimit: { max: 10, window: 60 } },
);
