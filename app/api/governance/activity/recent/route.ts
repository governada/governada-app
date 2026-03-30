import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { cached } from '@/lib/redis';
import type { ActivityEvent } from '@/lib/intelligence/idleActivity';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'governance:activity:recent';
const CACHE_TTL = 300; // 5 minutes

export const GET = withRouteHandler(async () => {
  const events = await cached<ActivityEvent[]>(CACHE_KEY, CACHE_TTL, fetchRecentActivity);
  return NextResponse.json(events);
});

async function fetchRecentActivity(): Promise<ActivityEvent[]> {
  const supabase = createClient();

  // Run all queries in parallel — they're independent
  const [votesRes, ghiRes, scoresRes, proposalsRes] = await Promise.all([
    // 1. Recent votes (filter null block_time to avoid NaN sort)
    supabase
      .from('drep_votes')
      .select(
        'drep_id, vote, proposal_tx_hash, proposal_index, block_time, proposals!inner(title, type)',
      )
      .not('block_time', 'is', null)
      .order('block_time', { ascending: false })
      .limit(10),
    // 2. GHI snapshots (last 2 epochs)
    supabase
      .from('ghi_snapshots')
      .select('epoch_no, score, band')
      .order('epoch_no', { ascending: false })
      .limit(2),
    // 3. Score snapshots (last 2 epochs for delta comparison)
    supabase
      .from('drep_score_snapshots')
      .select('drep_id, score, epoch_no')
      .order('epoch_no', { ascending: false })
      .limit(100),
    // 4. Active proposals
    supabase
      .from('proposals')
      .select('tx_hash, index, title, type, status')
      .in('status', ['active', 'voting'])
      .limit(20),
  ]);

  const events: ActivityEvent[] = [];

  // 1. Recent notable votes (proposal_vote)
  const recentVotes = votesRes.data;
  if (recentVotes && recentVotes.length > 0) {
    const proposalVoteCounts = new Map<
      string,
      { count: number; title: string; hash: string; index: number; time: string }
    >();
    for (const v of recentVotes) {
      const key = `${v.proposal_tx_hash}_${v.proposal_index}`;
      const existing = proposalVoteCounts.get(key);
      const proposal = v.proposals as unknown as { title: string; type: string };
      if (!existing) {
        proposalVoteCounts.set(key, {
          count: 1,
          title: proposal.title ?? 'Governance Proposal',
          hash: v.proposal_tx_hash,
          index: v.proposal_index,
          time: v.block_time,
        });
      } else {
        existing.count++;
      }
    }

    const top = [...proposalVoteCounts.values()].sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
    )[0];

    if (top) {
      events.push({
        type: 'proposal_vote',
        headline: `${top.count} new vote${top.count > 1 ? 's' : ''} on "${truncate(top.title, 50)}"`,
        subLabel: 'Proposal',
        entityId: top.hash,
        entityType: 'proposal',
        globeCommand: { type: 'voteSplit', proposalRef: `${top.hash}_${top.index}` },
        timestamp: top.time,
        icon: 'vote',
      });
    }
  }

  // 2. GHI change
  const ghiSnapshots = ghiRes.data;
  if (ghiSnapshots && ghiSnapshots.length >= 2) {
    const current = ghiSnapshots[0];
    const previous = ghiSnapshots[1];
    const delta = Math.round(current.score - previous.score);
    if (Math.abs(delta) >= 1) {
      events.push({
        type: 'ghi_change',
        headline: `Governance health ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)} points to ${Math.round(current.score)}`,
        subLabel: `Epoch ${current.epoch_no} · ${current.band}`,
        globeCommand: {
          type: 'highlight',
          alignment: [50, 50, 50, 50, 50, 50],
          threshold: 250,
          noZoom: true,
        },
        timestamp: new Date().toISOString(),
        icon: 'health',
      });
    }
  }

  // 3. Score milestones — DReps with biggest score gain between epochs
  const scoreSnapshots = scoresRes.data;
  if (scoreSnapshots && scoreSnapshots.length > 0) {
    const epochs = [...new Set(scoreSnapshots.map((s) => s.epoch_no))].sort((a, b) => b - a);
    if (epochs.length >= 2) {
      const currentEpoch = epochs[0];
      const prevEpoch = epochs[1];
      const current = scoreSnapshots.filter((s) => s.epoch_no === currentEpoch);
      const prevMap = new Map(
        scoreSnapshots.filter((s) => s.epoch_no === prevEpoch).map((s) => [s.drep_id, s.score]),
      );

      let bestGain = { drepId: '', gain: 0, newScore: 0 };
      for (const s of current) {
        const prev = prevMap.get(s.drep_id) ?? 0;
        const gain = (s.score ?? 0) - prev;
        if (gain > bestGain.gain) {
          bestGain = { drepId: s.drep_id, gain, newScore: s.score ?? 0 };
        }
      }

      if (bestGain.gain >= 3 && bestGain.drepId) {
        events.push({
          type: 'score_milestone',
          headline: `A representative gained ${Math.round(bestGain.gain)} points this epoch (now ${Math.round(bestGain.newScore)})`,
          subLabel: 'Score milestone',
          entityId: bestGain.drepId,
          entityType: 'drep',
          globeCommand: { type: 'flyTo', nodeId: `drep_${bestGain.drepId}` },
          timestamp: new Date().toISOString(),
          icon: 'milestone',
        });
      }
    }
  }

  // 4. Active proposals accepting votes
  const activeProposals = proposalsRes.data;
  if (activeProposals && activeProposals.length > 0) {
    const proposal = activeProposals[0];
    events.push({
      type: 'threshold_approach',
      headline: `"${truncate(proposal.title ?? 'Proposal', 50)}" is accepting votes`,
      subLabel: proposal.type ?? 'Proposal',
      entityId: proposal.tx_hash,
      entityType: 'proposal',
      globeCommand: {
        type: 'flyTo',
        nodeId: `proposal_${proposal.tx_hash}_${proposal.index}`,
      },
      timestamp: new Date().toISOString(),
      icon: 'threshold',
    });
  }

  // Sort by timestamp desc, return top 5
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events.slice(0, 5);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
