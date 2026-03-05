import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

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

export async function POST(request: Request, { params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  const supabase = getSupabaseAdmin();

  const body = await request.json();
  const { statement_text } = body as { statement_text?: string };

  if (!statement_text?.trim()) {
    return NextResponse.json({ error: 'statement_text is required' }, { status: 400 });
  }

  const { data: pool } = await supabase
    .from('pools')
    .select('claimed_by, claimed_at')
    .eq('pool_id', poolId)
    .single();

  if (!pool?.claimed_by) {
    return NextResponse.json({ error: 'Pool not claimed' }, { status: 403 });
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
}
