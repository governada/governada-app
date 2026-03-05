import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request, { params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;
  const url = new URL(request.url);
  const entityType = url.searchParams.get('entityType') ?? 'drep';
  const entityId = url.searchParams.get('entityId');

  if (!entityId) return NextResponse.json({ data: null });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('governance_wrapped')
    .select('data, entity_type, entity_id, period_id')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('period_id', period)
    .single();

  return NextResponse.json({
    data: data?.data ?? null,
    entityType: data?.entity_type ?? entityType,
    entityId: data?.entity_id ?? entityId,
  });
}
