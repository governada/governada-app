import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const SHELLEY_GENESIS_TIMESTAMP = 1596491091;
const EPOCH_LENGTH_SECONDS = 432000;
const SHELLEY_BASE_EPOCH = 209;

function epochStartTime(epoch: number): number {
  return SHELLEY_GENESIS_TIMESTAMP + (epoch - SHELLEY_BASE_EPOCH) * EPOCH_LENGTH_SECONDS;
}

export const GET = withRouteHandler(async (_request, { requestId }) => {
    const now = Math.floor(Date.now() / 1000);
    const currentEpoch = blockTimeToEpoch(now);
    const epochEnd = epochStartTime(currentEpoch + 1);
    const secondsRemaining = Math.max(0, epochEnd - now);
    const epochProgress = Math.round(
      ((EPOCH_LENGTH_SECONDS - secondsRemaining) / EPOCH_LENGTH_SECONDS) * 100,
    );

    const supabase = createClient();

    const { data: expiringProposals } = await supabase
      .from('proposals')
      .select('tx_hash, proposal_index, title, proposal_type, expiration_epoch, proposed_epoch')
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null)
      .order('expiration_epoch', { ascending: true })
      .limit(10);

    const upcoming = (expiringProposals || [])
      .map((p) => {
        const expEpoch =
          p.expiration_epoch ?? (p.proposed_epoch != null ? p.proposed_epoch + 6 : null);
        const epochsLeft = expEpoch != null ? Math.max(0, expEpoch - currentEpoch) : null;
        return {
          txHash: p.tx_hash,
          index: p.proposal_index,
          title: p.title || 'Untitled',
          proposalType: p.proposal_type,
          epochsLeft,
          daysLeft: epochsLeft != null ? epochsLeft * 5 : null,
        };
      })
      .filter((p) => p.epochsLeft !== null && p.epochsLeft <= 6)
      .sort((a, b) => (a.epochsLeft ?? 99) - (b.epochsLeft ?? 99));

    captureServerEvent('governance_calendar_fetched', {
      current_epoch: currentEpoch,
      expiring_proposals: upcoming.length,
    });

    return NextResponse.json(
      {
        currentEpoch,
        secondsRemaining,
        epochProgress,
        upcoming,
      },
      {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' },
      },
    );
});
