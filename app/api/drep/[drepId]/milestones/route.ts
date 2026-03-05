import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const SCORE_THRESHOLDS = [50, 60, 70, 80, 90];

export async function GET(request: Request, { params }: { params: Promise<{ drepId: string }> }) {
  const { drepId } = await params;
  const url = new URL(request.url);
  const since = url.searchParams.get('since');

  const supabase = getSupabaseAdmin();

  const [currentResult, historyResult] = await Promise.all([
    supabase.from('dreps').select('score').eq('id', drepId).single(),
    supabase
      .from('drep_score_snapshots')
      .select('score, epoch_no')
      .eq('drep_id', drepId)
      .order('score', { ascending: false })
      .limit(1),
  ]);

  const currentScore = currentResult.data?.score ?? 0;
  const historicalBest = historyResult.data?.[0]?.score ?? 0;
  const personalBest = currentScore > historicalBest;

  const newlyThresholds: number[] = [];

  if (since) {
    const sinceDate = new Date(parseInt(since, 10)).toISOString();
    const { data: priorSnapshots } = await supabase
      .from('drep_score_snapshots')
      .select('score, epoch_no, created_at')
      .eq('drep_id', drepId)
      .lt('created_at', sinceDate)
      .order('created_at', { ascending: false })
      .limit(1);

    const priorScore = priorSnapshots?.[0]?.score ?? 0;
    for (const t of SCORE_THRESHOLDS) {
      if (priorScore < t && currentScore >= t) {
        newlyThresholds.push(t);
      }
    }
  }

  return NextResponse.json({
    personalBest,
    score: currentScore,
    previousBest: historicalBest,
    newlyThresholds,
  });
}
