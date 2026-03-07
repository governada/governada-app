import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { aggregateSentiment } from '@/lib/api/engagement-utils';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const { searchParams } = new URL(request.url);
    const proposalTxHash = searchParams.get('proposalTxHash');
    const proposalIndexStr = searchParams.get('proposalIndex');
    const drepId = searchParams.get('drepId');

    if (!proposalTxHash || !proposalIndexStr) {
      return NextResponse.json(
        { error: 'proposalTxHash and proposalIndex required' },
        { status: 400 },
      );
    }

    const proposalIndex = parseInt(proposalIndexStr, 10);
    if (isNaN(proposalIndex)) {
      return NextResponse.json({ error: 'proposalIndex must be a number' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: allVotes, error } = await supabase
      .from('citizen_sentiment')
      .select('sentiment, user_id, delegated_drep_id, stake_address')
      .eq('proposal_tx_hash', proposalTxHash)
      .eq('proposal_index', proposalIndex);

    if (error) {
      logger.error('Sentiment results query error', {
        context: 'engagement/sentiment/results',
        error: error.message,
      });
      return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
    }

    const rows = allVotes || [];
    const community = aggregateSentiment(rows);

    // User's own sentiment
    let userSentiment: string | null = null;
    if (userId) {
      const userRow = rows.find((r) => r.user_id === userId);
      if (userRow) userSentiment = userRow.sentiment;
    }

    const result: SentimentResultsResponse = {
      community,
      userSentiment: userSentiment as SentimentResultsResponse['userSentiment'],
      hasVoted: userSentiment !== null,
    };

    // DRep-specific: sentiment from their delegators
    if (drepId) {
      const delegatorRows = rows.filter((r) => r.delegated_drep_id === drepId);
      result.delegators = aggregateSentiment(delegatorRows);

      // Stake-weighted sentiment for this DRep's delegators
      if (delegatorRows.length > 0) {
        const stakeAddresses = delegatorRows
          .map((r) => r.stake_address)
          .filter((s): s is string => !!s);

        if (stakeAddresses.length > 0) {
          const { data: snapshots } = await supabase
            .from('drep_delegator_snapshots')
            .select('stake_address, delegated_amount')
            .eq('drep_id', drepId)
            .in('stake_address', stakeAddresses)
            .order('epoch', { ascending: false })
            .limit(stakeAddresses.length * 3);

          if (snapshots && snapshots.length > 0) {
            // Dedupe to latest snapshot per stake_address
            const stakeMap = new Map<string, number>();
            for (const s of snapshots) {
              if (!stakeMap.has(s.stake_address)) {
                stakeMap.set(s.stake_address, s.delegated_amount);
              }
            }

            const weighted = { support: 0, oppose: 0, unsure: 0, total: 0 };
            for (const row of delegatorRows) {
              const amount = row.stake_address ? (stakeMap.get(row.stake_address) ?? 0) : 0;
              weighted.total += amount;
              if (row.sentiment === 'support') weighted.support += amount;
              else if (row.sentiment === 'oppose') weighted.oppose += amount;
              else if (row.sentiment === 'unsure') weighted.unsure += amount;
            }

            result.stakeWeighted = weighted;
          }
        }
      }
    }

    return NextResponse.json(result);
  },
  { auth: 'optional' },
);

interface SentimentResultsResponse {
  community: { support: number; oppose: number; unsure: number; total: number };
  delegators?: { support: number; oppose: number; unsure: number; total: number };
  stakeWeighted?: { support: number; oppose: number; unsure: number; total: number };
  userSentiment: 'support' | 'oppose' | 'unsure' | null;
  hasVoted: boolean;
}
