import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { epochToTimestamp } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * Temporal governance data for a specific epoch.
 *
 * Returns a timeline of governance events (votes, delegations, proposals)
 * ordered by timestamp. Used by the globe temporal replay feature.
 *
 * Query params:
 *   epoch (required) — epoch number
 *   limit (optional) — max events (default 500, max 2000)
 */
export const GET = withRouteHandler(async (request) => {
  const epochParam = request.nextUrl.searchParams.get('epoch');
  if (!epochParam) {
    return NextResponse.json({ error: 'epoch parameter required' }, { status: 400 });
  }

  const epoch = parseInt(epochParam, 10);
  if (isNaN(epoch) || epoch < 200) {
    return NextResponse.json({ error: 'Invalid epoch' }, { status: 400 });
  }

  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = Math.min(parseInt(limitParam || '500', 10) || 500, 2000);

  const supabase = createClient();

  const epochStart = epochToTimestamp(epoch);
  const epochEnd = epochToTimestamp(epoch + 1);

  // Fetch vote events for this epoch
  const { data: votes } = await supabase
    .from('drep_votes')
    .select('drep_id, proposal_tx_hash, proposal_index, vote, block_time')
    .eq('epoch_no', epoch)
    .order('block_time', { ascending: true })
    .limit(limit);

  // Fetch delegation snapshot for this epoch (one snapshot per DRep)
  const { data: delegations } = await supabase
    .from('delegation_snapshots')
    .select('drep_id, delegator_count, total_power_lovelace, snapshot_at, new_delegators')
    .eq('epoch', epoch)
    .order('snapshot_at', { ascending: true })
    .limit(200);

  // Fetch epoch recap narrative
  const { data: recap } = await supabase
    .from('epoch_recaps')
    .select(
      'proposals_submitted, proposals_ratified, proposals_expired, drep_participation_pct, ai_narrative',
    )
    .eq('epoch', epoch)
    .maybeSingle();

  // Build timeline events
  interface TemporalEvent {
    timestamp: number;
    type: 'vote' | 'delegation_snapshot' | 'epoch_start' | 'epoch_end';
    entityId: string;
    vote?: string;
    proposalRef?: string;
    delegatorCount?: number;
    votingPower?: number;
  }

  const events: TemporalEvent[] = [];

  // Epoch boundary markers
  events.push({ timestamp: epochStart, type: 'epoch_start', entityId: `epoch_${epoch}` });
  events.push({ timestamp: epochEnd, type: 'epoch_end', entityId: `epoch_${epoch}` });

  // Vote events
  if (votes) {
    for (const v of votes) {
      events.push({
        timestamp: v.block_time,
        type: 'vote',
        entityId: v.drep_id,
        vote: v.vote,
        proposalRef: `${v.proposal_tx_hash}_${v.proposal_index}`,
      });
    }
  }

  // Delegation snapshots — place them at snapshot time
  if (delegations) {
    for (const d of delegations) {
      const ts = d.snapshot_at ? new Date(d.snapshot_at).getTime() / 1000 : epochStart;
      events.push({
        timestamp: ts,
        type: 'delegation_snapshot',
        entityId: d.drep_id,
        delegatorCount: d.delegator_count,
        votingPower: d.total_power_lovelace,
      });
    }
  }

  // Sort all events by timestamp
  events.sort((a, b) => a.timestamp - b.timestamp);

  return NextResponse.json(
    {
      epoch,
      epochStart,
      epochEnd,
      eventCount: events.length,
      events,
      recap: recap ?? null,
    },
    {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    },
  );
});
