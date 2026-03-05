import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ drepId: string }> },
) {
  const { drepId } = await params;
  const url = new URL(request.url);
  const since = url.searchParams.get('since');

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('tier_changes')
    .select('id, old_tier, new_tier, old_score, new_score, epoch_no, created_at')
    .eq('entity_type', 'drep')
    .eq('entity_id', drepId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (since) {
    query = query.gt('created_at', new Date(parseInt(since, 10)).toISOString());
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
