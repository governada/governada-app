import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request: NextRequest) => {
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

    const [openedResult, closedResult] = await Promise.all([
      supabase
        .from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .gte('block_time', sinceBlockTime),
      supabase
        .from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .gte('block_time', sinceBlockTime)
        .not('ratified_epoch', 'is', null),
    ]);

    const proposalsOpened = openedResult.count || 0;
    const proposalsClosed = closedResult.count || 0;

    // Proposal outcomes: proposals that reached a terminal state since last visit
    const [ratifiedResult, expiredResult, droppedResult] = await Promise.all([
      supabase
        .from('proposals')
        .select('tx_hash, title, ratified_epoch, enacted_epoch')
        .gte('ratified_epoch', sinceEpoch),
      supabase
        .from('proposals')
        .select('tx_hash, title, expired_epoch')
        .gte('expired_epoch', sinceEpoch),
      supabase
        .from('proposals')
        .select('tx_hash, title, dropped_epoch')
        .gte('dropped_epoch', sinceEpoch),
    ]);

    const proposalOutcomes = {
      passed: (ratifiedResult.data || []).map((p) => ({ title: p.title, txHash: p.tx_hash })),
      expired: (expiredResult.data || []).map((p) => ({ title: p.title, txHash: p.tx_hash })),
      dropped: (droppedResult.data || []).map((p) => ({ title: p.title, txHash: p.tx_hash })),
    };

    let drepVotesCast = 0;
    let drepScoreChange: number | null = null;
    let delegatorChange: number | null = null;
    let drepActivity: { votesCast: number; rationalesProvided: number } | null = null;

    if (drepId) {
      const [votesResult, rationaleResult, latestScoreResult, oldScoreResult, currentDrepResult] =
        await Promise.all([
          supabase
            .from('drep_votes')
            .select('vote_tx_hash', { count: 'exact', head: true })
            .eq('drep_id', drepId)
            .gt('block_time', sinceBlockTime),
          supabase
            .from('drep_votes')
            .select('vote_tx_hash', { count: 'exact', head: true })
            .eq('drep_id', drepId)
            .gt('block_time', sinceBlockTime)
            .not('meta_url', 'is', null),
          supabase
            .from('drep_score_history')
            .select('score, snapshot_date')
            .eq('drep_id', drepId)
            .order('snapshot_date', { ascending: false })
            .limit(1),
          supabase
            .from('drep_score_history')
            .select('score, snapshot_date')
            .eq('drep_id', drepId)
            .lte('snapshot_date', sinceDate.toISOString().split('T')[0])
            .order('snapshot_date', { ascending: false })
            .limit(1),
          supabase.from('dreps').select('info').eq('id', drepId).single(),
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
  },
  { auth: 'required' },
);
