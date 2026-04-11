import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import type { AlignmentDimension } from '@/lib/drepIdentity';
import { extractAlignments, alignmentsToArray, getDominantDimension } from '@/lib/drepIdentity';
import type { ConstellationApiData } from '@/lib/constellation/types';
import { buildProposalConstellationNodes } from '@/lib/constellation/proposalNodes';
import { buildPrecomputedConstellationNodes } from '@/lib/constellation/sceneNodes';
import type { LayoutInput } from '@/lib/constellation/globe-layout';
import {
  fetchProposalVotingSummaries,
  indexProposalVotingSummaryTriBodies,
} from '@/lib/governance/proposalVotingSummary';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async () => {
  const supabase = createClient();
  const oneWeekAgo = Math.floor(Date.now() / 1000) - 604800;

  const [
    drepsResult,
    votesResult,
    rationalesResult,
    proposalsResult,
    governanceStatsResult,
    pulseResult,
    spoVotesResult,
    ccVotesResult,
  ] = await Promise.all([
    // Include all DReps with voting power > 0 (the isActive JSONB field is unreliable —
    // only 6 of 1100+ rows have it set). Filter by voting power as the source of truth.
    supabase
      .from('dreps')
      .select(
        'id, score, info, size_tier, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
      )
      .gt('info->>votingPowerLovelace', '0'),

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
        'tx_hash, proposal_index, title, proposal_type, block_time, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch, expiration_epoch, proposed_epoch, withdrawal_amount, relevant_prefs',
      )
      .order('proposed_epoch', { ascending: false })
      .limit(100),

    supabase.from('governance_stats').select('current_epoch').eq('id', 1).single(),

    supabase
      .from('dreps')
      .select('score, info', { count: 'exact', head: false })
      .gt('info->>votingPowerLovelace', '0'),

    supabase
      .from('pools')
      .select(
        'pool_id, ticker, pool_name, governance_score, vote_count, relay_lat, relay_lon, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
      )
      .gt('vote_count', 0),

    supabase
      .from('cc_members')
      .select(
        'cc_hot_id, cc_cold_id, author_name, fidelity_grade, fidelity_score, status, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
      )
      .eq('status', 'authorized')
      .limit(7),
  ]);

  // CC rationale name fallback (separate query to avoid TS Promise.all tuple limit)
  const ccRationaleNamesResult = await supabase
    .from('cc_rationales')
    .select('cc_hot_id, author_name')
    .not('author_name', 'is', null);

  const dreps = drepsResult.data || [];
  const votes = votesResult.data || [];
  const rationales = rationalesResult.data || [];
  const proposals = proposalsResult.data || [];
  const currentEpoch = governanceStatsResult.data?.current_epoch ?? null;

  const proposalTxHashes = [...new Set(proposals.map((proposal) => proposal.tx_hash))];
  const proposalTriBodyMap = indexProposalVotingSummaryTriBodies(
    await fetchProposalVotingSummaries(
      supabase,
      proposalTxHashes,
      'proposal_tx_hash, proposal_index, drep_yes_votes_cast, drep_no_votes_cast, drep_abstain_votes_cast, pool_yes_votes_cast, pool_no_votes_cast, pool_abstain_votes_cast, committee_yes_votes_cast, committee_no_votes_cast, committee_abstain_votes_cast',
    ),
  );

  // Compute total ADA governed
  const allActive = pulseResult.data || [];
  const totalLovelace = allActive.reduce((sum: number, d) => {
    const info = d.info as Record<string, unknown> | null;
    const lv = parseInt((info?.votingPowerLovelace as string) || '0', 10);
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
    (p) => !p.ratified_epoch && !p.enacted_epoch && !p.dropped_epoch && !p.expired_epoch,
  );
  const proposalNodes = buildProposalConstellationNodes(
    openProposals.map((proposal) => ({
      txHash: proposal.tx_hash,
      index: proposal.proposal_index,
      title: proposal.title,
      status: 'Open',
      withdrawalAmount:
        proposal.withdrawal_amount != null ? Number(proposal.withdrawal_amount) : null,
      expirationEpoch: proposal.expiration_epoch ?? null,
      relevantPrefs: proposal.relevant_prefs ?? [],
      triBody: proposalTriBodyMap.get(`${proposal.tx_hash}-${proposal.proposal_index}`) ?? null,
    })),
    currentEpoch,
  );

  // Build nodes
  const maxPower = Math.max(
    ...dreps.map((d) => {
      const info = d.info as Record<string, unknown> | null;
      return parseInt((info?.votingPowerLovelace as string) || '0', 10) || 0;
    }),
    1,
  );

  const drepNodes: LayoutInput[] = dreps.map((d) => {
    const info = d.info as Record<string, unknown> | null;
    const raw = parseInt((info?.votingPowerLovelace as string) || '0', 10) || 0;
    const adaAmount = Math.round(raw / 1_000_000);
    const alignments = extractAlignments(d);
    const arr = alignmentsToArray(alignments);
    return {
      id: (d.id as string).slice(0, 16),
      fullId: d.id as string,
      name: (info?.name as string) || (info?.ticker as string) || (info?.handle as string) || null,
      power: raw / maxPower,
      score: d.score || 0,
      dominant: getDominantDimension(alignments),
      alignments: arr,
      nodeType: 'drep' as const,
      adaAmount,
      delegatorCount: parseInt(String(info?.delegatorCount ?? '0'), 10) || 0,
    };
  });

  const poolsData = spoVotesResult.data || [];
  const ccMembers = ccVotesResult.data || [];

  // Build CC rationale name fallback map (first name found per cc_hot_id)
  const ccNameMap = new Map<string, string>();
  for (const r of ccRationaleNamesResult.data ?? []) {
    if (r.author_name && !ccNameMap.has(r.cc_hot_id as string)) {
      ccNameMap.set(r.cc_hot_id as string, r.author_name as string);
    }
  }

  const maxPoolVotes = Math.max(...poolsData.map((p) => p.vote_count || 0), 1);
  const spoNodes: LayoutInput[] = poolsData.map((p) => {
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
      fullId: p.pool_id as string,
      name: p.ticker || p.pool_name || null,
      power: (p.vote_count || 0) / maxPoolVotes,
      score: p.governance_score ?? 50,
      dominant: getDominantDimension(aligns),
      alignments: arr,
      nodeType: 'spo' as const,
      voteCount: p.vote_count || 0,
      ...(p.relay_lat != null && p.relay_lon != null
        ? { geoLat: p.relay_lat, geoLon: p.relay_lon }
        : {}),
    };
  });

  // CC members — read pre-computed alignment from sync pipeline (columns added via migration)
  // Falls back to neutral [50,50,50,50,50,50] if alignment not yet computed
  const ccNodes: LayoutInput[] = ccMembers.map((m) => {
    const aligns = extractAlignments(m);
    const arr = alignmentsToArray(aligns);
    const hasAlignment = arr.some((v) => Math.abs(v - 50) > 3);
    return {
      id: (m.cc_hot_id as string).slice(0, 16),
      fullId: m.cc_hot_id as string,
      name: (m.author_name as string) || ccNameMap.get(m.cc_hot_id as string) || null,
      power: 0.8,
      score: (m.fidelity_score as number) ?? 75,
      dominant: hasAlignment
        ? getDominantDimension(aligns)
        : ('transparency' as AlignmentDimension),
      alignments: arr,
      nodeType: 'cc' as const,
      fidelityGrade: (m.fidelity_grade as string) || undefined,
    };
  });

  const nodes = buildPrecomputedConstellationNodes([...drepNodes, ...spoNodes, ...ccNodes]);

  // Build recent events
  const proposalMap = new Map(proposals.map((p) => [p.tx_hash, p]));

  const recentEvents: ConstellationApiData['recentEvents'] = [];

  for (const v of votes.slice(0, 15)) {
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
      timestamp: p.block_time ? p.block_time : Date.now() / 1000,
    });
  }

  recentEvents.sort((a, b) => b.timestamp - a.timestamp);

  const response: ConstellationApiData = {
    nodes,
    proposalNodes,
    recentEvents: recentEvents.slice(0, 30),
    stats: {
      totalAdaGoverned: formattedAda,
      activeProposals: proposalNodes.length,
      votesThisWeek: votes.length,
      activeDReps: dreps.length,
      activeSpOs: poolsData.length,
      ccMembers: ccMembers.length,
    },
  };

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' },
  });
});
