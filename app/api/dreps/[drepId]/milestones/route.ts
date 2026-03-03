import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ drepId: string }> },
) {
  try {
    const { drepId } = await params;
    const supabase = createClient();
    const { data } = await supabase
      .from('drep_milestones')
      .select('milestone_key, achieved_at')
      .eq('drep_id', drepId)
      .order('achieved_at', { ascending: false });

    const milestones = (data || []).map((d: { milestone_key: string; achieved_at: string }) => ({
      milestoneKey: d.milestone_key,
      achievedAt: d.achieved_at,
    }));

    return NextResponse.json({ milestones });
  } catch (error) {
    console.error('Milestones API error:', error);
    return NextResponse.json({ milestones: [] });
  }
}
