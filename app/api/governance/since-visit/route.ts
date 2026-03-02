import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';

export const dynamic = 'force-dynamic';

async function authenticateRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const session = await validateSessionToken(token);
  return session?.walletAddress ?? null;
}

export async function GET(request: NextRequest) {
  const walletAddress = await authenticateRequest(request);
  if (!walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since = request.nextUrl.searchParams.get('since');
  const drepId = request.nextUrl.searchParams.get('drepId');

  if (!since) {
    return NextResponse.json({ error: 'Missing since parameter' }, { status: 400 });
  }

  const sinceDate = new Date(since);
  if (isNaN(sinceDate.getTime())) {
    return NextResponse.json({ error: 'Invalid since timestamp' }, { status: 400 });
  }

  const sinceBlockTime = Math.floor(sinceDate.getTime() / 1000);
  const sinceEpoch = blockTimeToEpoch(sinceBlockTime);
  const supabase = createClient();

  try {
    const [openedResult, closedResult] = await Promise.all([
      supabase.from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .gte('created_at', sinceDate.toISOString()),
      supabase.from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .gte('created_at', sinceDate.toISOString())
        .not('ratified_epoch', 'is', null),
    ]);

    const proposalsOpened = openedResult.count || 0;
    const proposalsClosed = closedResult.count || 0;

    // Proposal outcomes: proposals that reached a terminal state since last visit
    const [ratifiedResult, expiredResult, droppedResult] = await Promise.all([
      supabase.from('proposals')
        .select('tx_hash, title, ratified_epoch, enacted_epoch')
        .gte('ratified_epoch', sinceEpoch),
      supabase.from('proposals')
        .select('tx_hash, title, expired_epoch')
        .gte('expired_epoch', sinceEpoch),
      supabase.from('proposals')
        .select('tx_hash, title, dropped_epoch')
        .gte('dropped_epoch', sinceEpoch),
    ]);

    const proposalOutcomes = {
      passed: (ratifiedResult.data || []).map(p => ({ title: p.title, txHash: p.tx_hash })),
      expired: (expiredResult.data || []).map(p => ({ title: p.title, txHash: p.tx_hash })),
      dropped: (droppedResult.data || []).map(p => ({ title: p.title, txHash: p.tx_hash })),
    };

    let drepVotesCast = 0;
    let drepScoreChange: number | null = null;
    let delegatorChange: number | null = null;
    let drepActivity: { votesCast: number; rationalesProvided: number } | null = null;

    if (drepId) {
      const [votesResult, rationaleResult, latestScoreResult, oldScoreResult, currentDrepResult] = await Promise.all([
        supabase.from('drep_votes')
          .select('vote_tx_hash', { count: 'exact', head: true })
          .eq('drep_id', drepId)
          .gt('block_time', sinceBlockTime),
        supabase.from('drep_votes')
          .select('vote_tx_hash', { count: 'exact', head: true })
          .eq('drep_id', drepId)
          .gt('block_time', sinceBlockTime)
          .not('meta_url', 'is', null),
        supabase.from('drep_score_history')
          .select('score, recorded_at')
          .eq('drep_id', drepId)
          .order('recorded_at', { ascending: false })
          .limit(1),
        supabase.from('drep_score_history')
          .select('score, recorded_at')
          .eq('drep_id', drepId)
          .lte('recorded_at', sinceDate.toISOString())
          .order('recorded_at', { ascending: false })
          .limit(1),
        supabase.from('dreps')
          .select('info')
          .eq('drep_id', drepId)
          .single(),
      ]);

      drepVotesCast = votesResult.count || 0;

      drepActivity = {
        votesCast: votesResult.count || 0,
        rationalesProvided: rationaleResult.count || 0,
      };

      const latestScore = latestScoreResult.data?.[0]?.score ?? null;
      const oldScore = oldScoreResult.data?.[0]?.score ?? null;

      if (latestScore !== null && oldScore !== null) {
        drepScoreChange = Math.round((latestScore - oldScore) * 10) / 10;
      }

      const currentDelegators = currentDrepResult.data?.info?.delegatorCount ?? null;
      if (currentDelegators !== null) {
        delegatorChange = currentDelegators;
      }
    }

    return NextResponse.json({
      proposalsOpened,
      proposalsClosed,
      drepVotesCast,
      drepScoreChange,
      delegatorChange,
      proposalOutcomes,
      drepActivity,
    });
  } catch (err) {
    console.error('[Since Visit API] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
