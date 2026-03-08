import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

interface TimelineEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  drepId: string | null;
  proposalTxHash: string | null;
  proposalIndex: number | null;
  epoch: number | null;
  createdAt: string;
}

export const GET = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const supabase = getSupabaseAdmin();
    const [eventsResult, pollResult] = await Promise.all([
      supabase
        .from('governance_events')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('poll_responses')
        .select('proposal_tx_hash, proposal_index, vote, created_at')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false }),
    ]);

    const dbEvents: TimelineEvent[] = (eventsResult.data || []).map((e) => ({
      id: String(e.id),
      type: e.event_type,
      data: e.event_data || {},
      drepId: e.related_drep_id,
      proposalTxHash: e.related_proposal_tx_hash,
      proposalIndex: e.related_proposal_index,
      epoch: e.epoch,
      createdAt: e.created_at,
    }));

    // Track which poll votes already have a governance_event so we don't duplicate
    const existingPollKeys = new Set(
      dbEvents
        .filter((e) => e.type === 'poll_vote' && e.proposalTxHash)
        .map((e) => `${e.proposalTxHash}-${e.proposalIndex}`),
    );

    const pollVotes = pollResult.data || [];
    const missingPolls = pollVotes.filter(
      (pv) => !existingPollKeys.has(`${pv.proposal_tx_hash}-${pv.proposal_index}`),
    );

    // Fetch proposal titles for synthesized events
    const proposalTitleMap = new Map<string, string>();
    if (missingPolls.length > 0) {
      const txHashes = [...new Set(missingPolls.map((p) => p.proposal_tx_hash))];
      const { data: proposals } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, title')
        .in('tx_hash', txHashes);

      for (const p of proposals || []) {
        if (p.title) {
          proposalTitleMap.set(`${p.tx_hash}-${p.proposal_index}`, p.title);
        }
      }
    }

    const synthesizedEvents: TimelineEvent[] = missingPolls.map((pv, i) => {
      const key = `${pv.proposal_tx_hash}-${pv.proposal_index}`;
      const createdAt = pv.created_at;
      const epoch = createdAt
        ? blockTimeToEpoch(Math.floor(new Date(createdAt).getTime() / 1000))
        : null;

      return {
        id: `synth-poll-${i}`,
        type: 'poll_vote',
        data: {
          vote: pv.vote,
          proposalTitle: proposalTitleMap.get(key) || null,
        },
        drepId: null,
        proposalTxHash: pv.proposal_tx_hash,
        proposalIndex: pv.proposal_index,
        epoch,
        createdAt: createdAt || new Date().toISOString(),
      };
    });

    const allEvents = [...dbEvents, ...synthesizedEvents].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return NextResponse.json({ events: allEvents.slice(0, 50) });
  },
  { auth: 'required' },
);
