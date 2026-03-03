import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { getProposalPriority } from '@/utils/proposalPriority';
import type { AlignmentDimension } from '@/lib/drepIdentity';
import { extractAlignments, alignmentsToArray, getDominantDimension } from '@/lib/drepIdentity';
import type { ConstellationApiData } from '@/lib/constellation/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    const oneWeekAgo = Math.floor(Date.now() / 1000) - 604800;

    const [
      drepsResult,
      votesResult,
      rationalesResult,
      proposalsResult,
      pulseResult,
      spoVotesResult,
      ccVotesResult,
    ] = await Promise.all([
      supabase
        .from('dreps')
        .select(
          'id, score, info, size_tier, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
        )
        .eq('info->>isActive', 'true'),

      supabase
        .from('drep_votes')
        .select('drep_id, vote, block_time, proposal_tx_hash')
        .gt('block_time', oneWeekAgo)
        .order('block_time', { ascending: false })
        .limit(50),

      supabase
        .from('vote_rationales')
        .select('drep_id, fetched_at')
        .not('rationale_text', 'is', null)
        .order('fetched_at', { ascending: false })
        .limit(20),

      supabase
        .from('proposals')
        .select(
          'tx_hash, proposal_index, title, proposal_type, created_at, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch',
        )
        .order('created_at', { ascending: false })
        .limit(20),

      supabase
        .from('dreps')
        .select('score, info', { count: 'exact', head: false })
        .eq('info->>isActive', 'true'),

      supabase
        .from('pools')
        .select(
          'pool_id, ticker, pool_name, governance_score, vote_count, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
        )
        .gt('vote_count', 0),

      supabase.from('cc_votes').select('cc_hot_id').limit(100),
    ]);

    const dreps = drepsResult.data || [];
    const votes = votesResult.data || [];
    const rationales = rationalesResult.data || [];
    const proposals = proposalsResult.data || [];

    // Compute total ADA governed
    const allActive = pulseResult.data || [];
    const totalLovelace = allActive.reduce((sum: number, d: any) => {
      const lv = parseInt(d.info?.votingPowerLovelace || '0', 10);
      return sum + (isNaN(lv) ? 0 : lv);
    }, 0);
    const totalAda = totalLovelace / 1_000_000;
    const formattedAda =
      totalAda >= 1_000_000_000
        ? `${(totalAda / 1_000_000_000).toFixed(1)}B`
        : totalAda >= 1_000_000
          ? `${(totalAda / 1_000_000).toFixed(1)}M`
          : `${Math.round(totalAda).toLocaleString()}`;

    const openProposals = proposals.filter(
      (p: any) => !p.ratified_epoch && !p.enacted_epoch && !p.dropped_epoch && !p.expired_epoch,
    );

    // Build nodes
    const maxPower = Math.max(
      ...dreps.map((d: any) => parseInt(d.info?.votingPowerLovelace || '0', 10) || 0),
      1,
    );

    const drepNodes: ConstellationApiData['nodes'] = dreps.map((d: any) => {
      const raw = parseInt(d.info?.votingPowerLovelace || '0', 10) || 0;
      const alignments = extractAlignments(d);
      const arr = alignmentsToArray(alignments);
      return {
        id: (d.id as string).slice(0, 16),
        name: d.info?.name || d.info?.ticker || d.info?.handle || null,
        power: raw / maxPower,
        score: d.score || 0,
        dominant: getDominantDimension(alignments),
        alignments: arr,
        nodeType: 'drep' as const,
      };
    });

    const poolsData = spoVotesResult.data || [];
    const ccIds = [...new Set((ccVotesResult.data || []).map((v: any) => v.cc_hot_id as string))];

    const maxPoolVotes = Math.max(...poolsData.map((p: any) => p.vote_count || 0), 1);
    const spoNodes: ConstellationApiData['nodes'] = poolsData.map((p: any) => {
      const aligns = {
        treasuryConservative: p.alignment_treasury_conservative ?? 50,
        treasuryGrowth: p.alignment_treasury_growth ?? 50,
        decentralization: p.alignment_decentralization ?? 50,
        security: p.alignment_security ?? 50,
        innovation: p.alignment_innovation ?? 50,
        transparency: p.alignment_transparency ?? 50,
      };
      const arr = alignmentsToArray(aligns);
      return {
        id: (p.pool_id as string).slice(0, 16),
        name: p.ticker || p.pool_name || null,
        power: (p.vote_count || 0) / maxPoolVotes,
        score: p.governance_score ?? 50,
        dominant: getDominantDimension(aligns),
        alignments: arr,
        nodeType: 'spo' as const,
      };
    });

    const ccNodes: ConstellationApiData['nodes'] = ccIds.map((ccId) => ({
      id: ccId.slice(0, 16),
      name: null,
      power: 0.8,
      score: 75,
      dominant: 'transparency' as AlignmentDimension,
      alignments: [50, 50, 50, 50, 50, 50],
      nodeType: 'cc' as const,
    }));

    const nodes: ConstellationApiData['nodes'] = [...drepNodes, ...spoNodes, ...ccNodes];

    // Build recent events
    const drepsMap = new Map(dreps.map((d: any) => [d.id, d]));
    const proposalMap = new Map(proposals.map((p: any) => [p.tx_hash, p]));

    const recentEvents: ConstellationApiData['recentEvents'] = [];

    for (const v of votes.slice(0, 15)) {
      const drep = drepsMap.get(v.drep_id);
      const proposal = proposalMap.get(v.proposal_tx_hash);
      recentEvents.push({
        type: 'vote',
        drepId: (v.drep_id as string).slice(0, 16),
        detail: proposal?.title || undefined,
        vote: v.vote as 'Yes' | 'No' | 'Abstain',
        timestamp: v.block_time,
      });
    }

    for (const r of rationales.slice(0, 5)) {
      recentEvents.push({
        type: 'rationale',
        drepId: (r.drep_id as string).slice(0, 16),
        timestamp: r.fetched_at ? new Date(r.fetched_at).getTime() / 1000 : Date.now() / 1000,
      });
    }

    for (const p of openProposals.slice(0, 3)) {
      recentEvents.push({
        type: 'proposal',
        drepId: '',
        detail: p.title,
        timestamp: p.created_at ? new Date(p.created_at).getTime() / 1000 : Date.now() / 1000,
      });
    }

    recentEvents.sort((a, b) => b.timestamp - a.timestamp);

    const response: ConstellationApiData = {
      nodes,
      recentEvents: recentEvents.slice(0, 30),
      stats: {
        totalAdaGoverned: formattedAda,
        activeProposals: openProposals.length,
        votesThisWeek: votes.length,
        activeDReps: dreps.length,
        activeSpOs: poolsData.length,
        ccMembers: ccIds.length,
      },
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('Constellation API error:', error);
    return NextResponse.json({ error: 'Failed to fetch constellation data' }, { status: 500 });
  }
}
