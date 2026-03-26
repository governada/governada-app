export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

/**
 * GET /api/cockpit/network-edges
 *
 * Returns top delegation bonds and voting alignment pairs for the
 * Cockpit network overlay visualization.
 *
 * Cached for 5 minutes.
 */

interface NetworkEdge {
  from: string;
  to: string;
  type: 'delegation' | 'alignment' | 'cc-drep';
  weight: number;
}

export async function GET() {
  try {
    const supabase = createClient();
    const edges: NetworkEdge[] = [];

    // 1. Top delegation bonds (by voting power)
    const { data: delegations } = await supabase
      .from('drep_scores')
      .select('drep_id, delegator_count, voting_power')
      .gt('voting_power', 0)
      .order('voting_power', { ascending: false })
      .limit(20);

    if (delegations) {
      for (const d of delegations) {
        if (d.drep_id) {
          edges.push({
            from: `user-delegator`,
            to: d.drep_id,
            type: 'delegation',
            weight: Math.min(1, (d.voting_power ?? 0) / 50_000_000),
          });
        }
      }
    }

    // 2. Voting alignment pairs — DReps who vote similarly
    // Use cached vote correlation data if available
    const { data: voteData } = await supabase
      .from('drep_votes')
      .select('drep_id, proposal_tx_hash, vote')
      .order('created_at', { ascending: false })
      .limit(500);

    if (voteData && voteData.length > 0) {
      // Build vote map per DRep
      const voteMap = new Map<string, Map<string, string>>();
      for (const v of voteData) {
        if (!v.drep_id || !v.proposal_tx_hash) continue;
        if (!voteMap.has(v.drep_id)) voteMap.set(v.drep_id, new Map());
        voteMap.get(v.drep_id)!.set(v.proposal_tx_hash, v.vote ?? '');
      }

      // Find top alignment pairs (>80% agreement on shared proposals)
      const drepIds = [...voteMap.keys()];
      const alignmentPairs: { from: string; to: string; agreement: number }[] = [];

      for (let i = 0; i < Math.min(drepIds.length, 50); i++) {
        for (let j = i + 1; j < Math.min(drepIds.length, 50); j++) {
          const a = voteMap.get(drepIds[i])!;
          const b = voteMap.get(drepIds[j])!;
          let shared = 0;
          let agreed = 0;
          for (const [proposal, voteA] of a) {
            const voteB = b.get(proposal);
            if (voteB) {
              shared++;
              if (voteA === voteB) agreed++;
            }
          }
          if (shared >= 3 && agreed / shared >= 0.8) {
            alignmentPairs.push({
              from: drepIds[i],
              to: drepIds[j],
              agreement: agreed / shared,
            });
          }
        }
      }

      // Take top 10 alignment pairs
      alignmentPairs
        .sort((a, b) => b.agreement - a.agreement)
        .slice(0, 10)
        .forEach((pair) => {
          edges.push({
            from: pair.from,
            to: pair.to,
            type: 'alignment',
            weight: pair.agreement,
          });
        });
    }

    return NextResponse.json(
      { edges: edges.slice(0, 30) },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (error) {
    console.error('[cockpit/network-edges] Error:', error);
    return NextResponse.json({ edges: [] }, { status: 200 });
  }
}
