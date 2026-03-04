import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface ActivityEvent {
  type: 'vote' | 'rationale' | 'proposal' | 'score_change' | 'proposal_outcome';
  drepId: string;
  drepName: string | null;
  detail: string | null;
  vote?: 'Yes' | 'No' | 'Abstain';
  timestamp: number;
  proposalTxHash?: string;
  proposalIndex?: number;
}

export const GET = withRouteHandler(async (request, { requestId }) => {
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '30', 10), 50);
    const drepIdFilter = request.nextUrl.searchParams.get('drepId') || null;
    const supabase = createClient();
    const oneWeekAgo = Math.floor(Date.now() / 1000) - 604800;

    let votesQuery = supabase
      .from('drep_votes')
      .select('drep_id, vote, block_time, proposal_tx_hash, proposal_index')
      .gt('block_time', oneWeekAgo)
      .order('block_time', { ascending: false })
      .limit(limit);
    if (drepIdFilter) votesQuery = votesQuery.eq('drep_id', drepIdFilter);

    let rationalesQuery = supabase
      .from('vote_rationales')
      .select('drep_id, fetched_at')
      .not('rationale_text', 'is', null)
      .order('fetched_at', { ascending: false })
      .limit(Math.ceil(limit / 3));
    if (drepIdFilter) rationalesQuery = rationalesQuery.eq('drep_id', drepIdFilter);

    const [votesResult, rationalesResult, proposalsResult] = await Promise.all([
      votesQuery,
      rationalesQuery,
      supabase
        .from('proposals')
        .select(
          'tx_hash, proposal_index, title, created_at, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch',
        )
        .order('created_at', { ascending: false })
        .limit(Math.ceil(limit / 3)),
    ]);

    const votes = votesResult.data || [];
    const rationales = rationalesResult.data || [];
    const proposals = proposalsResult.data || [];

    // Fetch DRep names for referenced drep_ids
    const drepIds = new Set<string>();
    for (const v of votes) drepIds.add(v.drep_id);
    for (const r of rationales) drepIds.add(r.drep_id);

    const drepIdsArr = [...drepIds].slice(0, 100);
    const drepsResult =
      drepIdsArr.length > 0
        ? await supabase.from('dreps').select('id, info').in('id', drepIdsArr)
        : { data: [] };

    const nameMap = new Map<string, string>();
    for (const d of drepsResult.data || []) {
      nameMap.set(d.id, d.info?.name || d.info?.ticker || d.info?.handle || null);
    }

    // Fetch proposal titles for referenced votes
    const proposalHashes = new Set(votes.map((v: any) => v.proposal_tx_hash));
    const proposalTitlesResult =
      proposalHashes.size > 0
        ? await supabase
            .from('proposals')
            .select('tx_hash, proposal_index, title')
            .in('tx_hash', [...proposalHashes].slice(0, 50))
        : { data: [] };

    const titleMap = new Map<string, string>();
    const proposalIndexMap = new Map<string, number>();
    for (const p of proposalTitlesResult.data || []) {
      titleMap.set(p.tx_hash, p.title);
      proposalIndexMap.set(p.tx_hash, p.proposal_index ?? 0);
    }

    const events: ActivityEvent[] = [];

    for (const v of votes) {
      events.push({
        type: 'vote',
        drepId: v.drep_id,
        drepName: nameMap.get(v.drep_id) || null,
        detail: titleMap.get(v.proposal_tx_hash) || null,
        vote: v.vote as 'Yes' | 'No' | 'Abstain',
        timestamp: v.block_time,
        proposalTxHash: v.proposal_tx_hash ?? undefined,
        proposalIndex: v.proposal_index ?? proposalIndexMap.get(v.proposal_tx_hash) ?? undefined,
      });
    }

    for (const r of rationales) {
      events.push({
        type: 'rationale',
        drepId: r.drep_id,
        drepName: nameMap.get(r.drep_id) || null,
        detail: null,
        timestamp: r.fetched_at
          ? Math.floor(new Date(r.fetched_at).getTime() / 1000)
          : Math.floor(Date.now() / 1000),
      });
    }

    const recentProposals = proposals.filter(
      (p: any) => p.created_at && new Date(p.created_at).getTime() > Date.now() - 7 * 86400000,
    );
    for (const p of recentProposals) {
      events.push({
        type: 'proposal',
        drepId: '',
        drepName: null,
        detail: p.title,
        timestamp: Math.floor(new Date(p.created_at).getTime() / 1000),
        proposalTxHash: p.tx_hash ?? undefined,
        proposalIndex: p.proposal_index ?? 0,
      });
    }

    // Proposal outcome events (ratified, enacted, dropped, expired)
    for (const p of proposals) {
      const outcomes: { epoch: number | null; label: string }[] = [
        { epoch: p.ratified_epoch, label: 'Ratified' },
        { epoch: p.enacted_epoch, label: 'Enacted' },
        { epoch: p.dropped_epoch, label: 'Dropped' },
        { epoch: p.expired_epoch, label: 'Expired' },
      ];
      for (const o of outcomes) {
        if (o.epoch) {
          events.push({
            type: 'proposal_outcome',
            drepId: '',
            drepName: null,
            detail: `${p.title || 'Proposal'} — ${o.label}`,
            timestamp: Math.floor(new Date(p.created_at).getTime() / 1000),
            proposalTxHash: p.tx_hash ?? undefined,
            proposalIndex: p.proposal_index ?? 0,
          });
        }
      }
    }

    // Score change events (significant moves >=5 pts in last week)
    if (!drepIdFilter) {
      const oneWeekAgoDate = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      const { data: scoreChanges } = await supabase
        .from('drep_score_history')
        .select('drep_id, score, snapshot_date')
        .gte('snapshot_date', oneWeekAgoDate)
        .order('snapshot_date', { ascending: false })
        .limit(50);

      if (scoreChanges && scoreChanges.length > 1) {
        const latestByDrep = new Map<string, { score: number; date: string }[]>();
        for (const sc of scoreChanges) {
          const arr = latestByDrep.get(sc.drep_id) || [];
          arr.push({ score: sc.score, date: sc.snapshot_date });
          latestByDrep.set(sc.drep_id, arr);
        }
        for (const [did, snapshots] of latestByDrep) {
          if (snapshots.length >= 2) {
            const delta = snapshots[0].score - snapshots[snapshots.length - 1].score;
            if (Math.abs(delta) >= 5) {
              const name = nameMap.get(did);
              const direction = delta > 0 ? '↑' : '↓';
              events.push({
                type: 'score_change',
                drepId: did,
                drepName: name || null,
                detail: `${name || did.slice(0, 8) + '…'} score ${direction}${Math.abs(delta)} pts`,
                timestamp: Math.floor(new Date(snapshots[0].date).getTime() / 1000),
              });
            }
          }
        }
      }
    }

    events.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json(events.slice(0, limit), {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
});
