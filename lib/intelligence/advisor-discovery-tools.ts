/**
 * advisor-discovery-tools.ts — Discovery-focused tool executors for Seneca.
 *
 * 4 tools for spatial governance discovery: highlight_cluster, show_neighborhood,
 * show_controversy, show_active_entities. Each returns ToolResult with globe commands.
 *
 * Tool executors use `any` for data rows since lib/data.ts types are complex.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { logger } from '@/lib/logger';
import type { GlobeCommand } from '@/lib/globe/types';
import type { ToolResult } from './advisor-tools';

function getProposalIndex(proposal: any): number {
  return (
    proposal.proposalIndex ?? proposal.proposal_index ?? proposal.index ?? proposal.certIndex ?? 0
  );
}

// ---------------------------------------------------------------------------
// highlight_cluster — Show a governance faction on the globe
// ---------------------------------------------------------------------------

export async function executeHighlightCluster(
  input: Record<string, unknown>,
): Promise<Omit<ToolResult, 'displayStatus'>> {
  try {
    // Read cluster data directly from Redis cache (same key the clusters API writes to)
    const { cached } = await import('@/lib/redis');
    const { getFeatureFlag } = await import('@/lib/featureFlags');

    const enabled = await getFeatureFlag('globe_alignment_layout', false);
    if (!enabled) {
      return {
        result:
          'Cluster detection is currently unavailable. The globe spatially groups DReps by governance alignment — DReps who share similar priorities appear near each other in the constellation.',
        globeCommands: [],
      };
    }

    // Use cached() with same key as the clusters API route — hits Redis without HTTP roundtrip
    const data = await cached<{
      clusters: Array<{
        id: string;
        name: string;
        description: string;
        centroid6D: number[];
        memberCount: number;
        dominantDimension: string;
        memberIds: string[];
      }>;
    }>('clusters:constellation:latest', 3600, async () => {
      // Cache miss fallback: return empty — the Inngest epoch job populates this
      return { clusters: [] };
    });

    const clusters = data.clusters;

    if (!clusters || clusters.length === 0) {
      return {
        result:
          'No governance factions detected yet. Factions emerge as DReps establish voting patterns.',
        globeCommands: [],
      };
    }

    const query = ((input.cluster_name as string) || (input.dimension as string) || '')
      .toLowerCase()
      .trim();

    // Match by name substring or dominant dimension
    const match = clusters.find(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.dominantDimension.toLowerCase().includes(query) ||
        c.id === query,
    );

    if (match) {
      return {
        result: `**${match.name}** — ${match.description}\n\n${match.memberCount} DReps in this faction. Dominant dimension: ${match.dominantDimension}.`,
        globeCommands: [{ type: 'highlightCluster', clusterId: match.id }],
      };
    }

    // No match — list available factions
    const list = clusters
      .map((c) => `- **${c.name}** (${c.memberCount} DReps, ${c.dominantDimension})`)
      .join('\n');

    return {
      result: `No faction matching "${input.cluster_name || input.dimension}". Available factions:\n${list}`,
      globeCommands: [],
    };
  } catch (err) {
    logger.error('[Discovery Tool] highlight_cluster failed', { error: err });
    return {
      result:
        'Unable to load faction data. The globe layout already positions DReps by governance alignment — similar philosophies cluster together spatially.',
      globeCommands: [],
    };
  }
}

// ---------------------------------------------------------------------------
// show_neighborhood — Find spatially nearby entities
// ---------------------------------------------------------------------------

export async function executeShowNeighborhood(
  input: Record<string, unknown>,
): Promise<Omit<ToolResult, 'displayStatus'>> {
  const { getAllDReps } = await import('@/lib/data');
  const entityId = input.entity_id as string;
  const entityType = (input.entity_type as string) || 'drep';
  const count = Math.min((input.count as number) || 5, 10);

  if (entityType !== 'drep') {
    return {
      result: `Neighborhood search is currently available for DReps only. Support for ${entityType}s coming soon.`,
      globeCommands: [],
    };
  }

  const { dreps } = await getAllDReps();

  // Find the target DRep
  const target = dreps.find(
    (d) =>
      d.drepId === entityId ||
      d.drepId.includes(entityId) ||
      (d.name || d.handle || '').toString().toLowerCase().includes(entityId.toLowerCase()),
  );

  if (!target) {
    return {
      result: `DRep "${entityId}" not found. Try searching by name or full ID.`,
      globeCommands: [{ type: 'clear' }],
    };
  }

  // Get target's alignment vector
  const targetVec = [
    target.alignmentTreasuryConservative ?? 50,
    target.alignmentTreasuryGrowth ?? 50,
    target.alignmentDecentralization ?? 50,
    target.alignmentSecurity ?? 50,
    target.alignmentInnovation ?? 50,
    target.alignmentTransparency ?? 50,
  ];

  // Compute distances to all other DReps
  const withDist = dreps
    .filter((d) => d.drepId !== target.drepId && d.alignmentTreasuryConservative != null)
    .map((d) => {
      const vec = [
        d.alignmentTreasuryConservative ?? 50,
        d.alignmentTreasuryGrowth ?? 50,
        d.alignmentDecentralization ?? 50,
        d.alignmentSecurity ?? 50,
        d.alignmentInnovation ?? 50,
        d.alignmentTransparency ?? 50,
      ];
      const dist = Math.sqrt(vec.reduce((sum, v, i) => sum + (v - targetVec[i]) ** 2, 0));
      return { ...d, _dist: dist };
    })
    .sort((a, b) => a._dist - b._dist);

  const neighbors = withDist.slice(0, count);
  const targetName = target.name || target.handle || target.drepId.slice(0, 16);

  const lines = neighbors.map((d, i) => {
    const name = d.name || d.handle || d.drepId.slice(0, 16);
    return `${i + 1}. ${name} — Score: ${d.drepScore ?? 0}, Distance: ${Math.round(d._dist)} | ID: ${d.drepId.slice(0, 24)}`;
  });

  // Globe: showNeighborhood behavior handles the narrowTo + pulse choreography
  const neighborNodeIds = [target.drepId, ...neighbors.map((n) => n.drepId)].map(
    (id) => `drep_${id}`,
  );
  const globeCommands: GlobeCommand[] = [
    {
      type: 'narrowTo',
      nodeIds: neighborNodeIds,
      fly: true,
    },
  ];

  return {
    result: `**${targetName}'s ${count} nearest neighbors** in governance alignment space:\n${lines.join('\n')}`,
    globeCommands,
  };
}

// ---------------------------------------------------------------------------
// show_controversy — Find proposals with the most divergent voting
// ---------------------------------------------------------------------------

export async function executeShowControversy(): Promise<Omit<ToolResult, 'displayStatus'>> {
  const { getAllProposalsWithVoteSummary } = await import('@/lib/data');

  const proposals: any[] = await getAllProposalsWithVoteSummary();
  if (!proposals || proposals.length === 0) {
    return { result: 'No proposals available to analyze for controversy.', globeCommands: [] };
  }

  // Filter to active/voted proposals with tri-body data
  const withVotes = proposals.filter(
    (p: any) =>
      p.triBody?.drep != null &&
      p.triBody?.spo != null &&
      (p.triBody.drep.yes + p.triBody.drep.no + p.triBody.drep.abstain > 0 ||
        p.triBody.spo.yes + p.triBody.spo.no + p.triBody.spo.abstain > 0),
  );

  if (withVotes.length === 0) {
    return { result: 'Not enough voting data to identify controversies yet.', globeCommands: [] };
  }

  // Compute tri-body divergence: how much DRep and SPO voting patterns disagree
  const scored = withVotes.map((p: any) => {
    const drepTotal = p.triBody.drep.yes + p.triBody.drep.no + p.triBody.drep.abstain;
    const spoTotal = p.triBody.spo.yes + p.triBody.spo.no + p.triBody.spo.abstain;
    const drepYesRate = drepTotal > 0 ? p.triBody.drep.yes / drepTotal : 0.5;
    const spoYesRate = spoTotal > 0 ? p.triBody.spo.yes / spoTotal : 0.5;
    const divergence = Math.abs(drepYesRate - spoYesRate);
    return { ...p, divergence, drepYesRate, spoYesRate };
  });

  scored.sort((a: any, b: any) => b.divergence - a.divergence);
  const top = scored.slice(0, 3);

  const lines = top.map((p: any, i: number) => {
    const hash = p.txHash || p.tx_hash || '';
    const proposalIndex = getProposalIndex(p);
    const drepPct = Math.round(p.drepYesRate * 100);
    const spoPct = Math.round(p.spoYesRate * 100);
    return `${i + 1}. "${truncate(String(p.title), 50)}" — DReps ${drepPct}% yes, SPOs ${spoPct}% yes | ${hash.slice(0, 12)}#${proposalIndex}`;
  });

  const topHash = top[0]?.txHash || top[0]?.tx_hash;
  const topIndex = top[0] ? getProposalIndex(top[0]) : 0;
  const globeCommands: GlobeCommand[] = topHash
    ? [{ type: 'showControversy', proposalId: `${topHash}_${topIndex}` }]
    : [];

  return {
    result: `**Most controversial proposals** (DRep vs SPO voting split):\n${lines.join('\n')}`,
    globeCommands,
  };
}

// ---------------------------------------------------------------------------
// show_active_entities — Show recently active governance participants
// ---------------------------------------------------------------------------

export async function executeShowActiveEntities(
  input: Record<string, unknown>,
): Promise<Omit<ToolResult, 'displayStatus'>> {
  const entityType = ((input.entity_type as string) || 'drep').toLowerCase();

  if (entityType === 'drep') {
    const { getSupabaseAdmin } = await import('@/lib/supabase');
    const supabase = getSupabaseAdmin();

    // Get DReps with most recent votes
    const { data: recentVoters } = await supabase
      .from('drep_votes')
      .select('drep_id, block_time')
      .order('block_time', { ascending: false })
      .limit(50);

    if (!recentVoters || recentVoters.length === 0) {
      return { result: 'No recent DRep voting activity found.', globeCommands: [] };
    }

    // Deduplicate by drep_id, keep most recent
    const seen = new Map<string, string>();
    for (const v of recentVoters) {
      if (!seen.has(v.drep_id)) seen.set(v.drep_id, v.block_time);
    }

    const activeIds = [...seen.keys()].slice(0, 8);

    // Fetch names
    const { data: drepInfo } = await supabase
      .from('dreps')
      .select('id, info, score')
      .in('id', activeIds);

    const lines = activeIds.map((id, i) => {
      const drep = drepInfo?.find((d) => d.id === id);
      const info = drep?.info as Record<string, unknown> | null;
      const name = (info?.name as string) || (info?.handle as string) || id.slice(0, 16) + '...';
      return `${i + 1}. ${name} — Score: ${drep?.score ?? '?'} | Last voted: ${seen.get(id)?.slice(0, 10) ?? 'recently'}`;
    });

    return {
      result: `**Most recently active DReps:**\n${lines.join('\n')}`,
      globeCommands: [{ type: 'showActiveEntities', entityType: 'drep', entityIds: activeIds }],
    };
  }

  if (entityType === 'proposal') {
    const { getAllProposalsWithVoteSummary } = await import('@/lib/data');
    const proposals: any[] = await getAllProposalsWithVoteSummary();
    const active = proposals.filter((p: any) => p.status === 'active').slice(0, 5);

    if (active.length === 0) {
      return { result: 'No active proposals at the moment.', globeCommands: [] };
    }

    const lines = active.map((p: any, i: number) => {
      const hash = p.txHash || p.tx_hash || '';
      const proposalIndex = getProposalIndex(p);
      return `${i + 1}. "${truncate(String(p.title), 50)}" (${p.status}) — ${hash.slice(0, 12)}#${proposalIndex}`;
    });

    const entityIds = active.map((p: any) => `${p.txHash || p.tx_hash}_${getProposalIndex(p)}`);

    return {
      result: `**Active proposals:**\n${lines.join('\n')}`,
      globeCommands: [{ type: 'showActiveEntities', entityType: 'proposal', entityIds }],
    };
  }

  return {
    result: `Entity type "${entityType}" not yet supported. Try "drep" or "proposal".`,
    globeCommands: [],
  };
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
