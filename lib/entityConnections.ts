/**
 * Entity Connections — computes relationships between governance entities.
 *
 * Each entity page gets a Connected panel showing up to 10 related entities.
 * Personal connections (viewer's DRep vote, alignment match %) are sorted first.
 * Enriched with "why this matters" context strings.
 *
 * Designed for server-side computation with 15-minute cache headers.
 */

import {
  getVotesByDRepId,
  getDRepById,
  getVotesByProposal,
  getSpoVotesByProposal,
  getCcVotesByProposal,
  getProposalByKey,
  getCCFidelityHistory,
  getCCMembersFidelity,
  getProposalsByIds,
} from '@/lib/data';
import { findSimilarByClassification } from '@/lib/proposalSimilarity';
import { getTreasuryBalance } from '@/lib/treasury';
import { getSupabaseAdmin } from '@/lib/supabase';

export type EntityType = 'drep' | 'proposal' | 'pool' | 'cc';

export interface EntityConnection {
  label: string;
  sublabel?: string;
  href: string;
  icon: 'user' | 'file-text' | 'building' | 'shield' | 'vote' | 'trending' | 'users' | 'link';
  /** True if this connection is personalized for the viewer */
  personalized: boolean;
}

export interface ConnectionContext {
  viewerDrepId?: string | null;
  viewerStakeAddress?: string | null;
}

export async function getEntityConnections(
  entityType: EntityType,
  entityId: string,
  context?: ConnectionContext,
): Promise<EntityConnection[]> {
  switch (entityType) {
    case 'drep':
      return getDRepConnections(entityId, context);
    case 'proposal':
      return getProposalConnections(entityId, context);
    case 'pool':
      return getPoolConnections(entityId);
    case 'cc':
      return getCCConnections(entityId);
  }
}

// ── DRep Connections ──────────────────────────────────────────────────────

async function getDRepConnections(
  drepId: string,
  context?: ConnectionContext,
): Promise<EntityConnection[]> {
  const connections: EntityConnection[] = [];
  const viewerDrepId = context?.viewerDrepId;

  const [drep, votes] = await Promise.all([getDRepById(drepId), getVotesByDRepId(drepId)]);

  if (!drep) return connections;

  // Viewer alignment match (personalized, goes first)
  if (viewerDrepId && viewerDrepId !== drepId) {
    const viewerDrep = await getDRepById(viewerDrepId);
    if (
      viewerDrep &&
      drep.alignmentTreasuryConservative != null &&
      viewerDrep.alignmentTreasuryConservative != null
    ) {
      // Compute simple alignment match from 6D alignment vectors
      const dims = [
        'alignmentTreasuryConservative',
        'alignmentTreasuryGrowth',
        'alignmentDecentralization',
        'alignmentSecurity',
        'alignmentInnovation',
        'alignmentTransparency',
      ] as const;
      let sumSqDiff = 0;
      let validDims = 0;
      for (const dim of dims) {
        const a = (drep as unknown as Record<string, unknown>)[dim] as number | null;
        const b = (viewerDrep as unknown as Record<string, unknown>)[dim] as number | null;
        if (a != null && b != null) {
          sumSqDiff += (a - b) ** 2;
          validDims++;
        }
      }
      if (validDims > 0) {
        const distance = Math.sqrt(sumSqDiff / validDims);
        const matchPct = Math.max(0, Math.round((1 - distance / 100) * 100));
        connections.push({
          label: `${matchPct}% aligned with your DRep`,
          sublabel: matchPct < 50 ? 'Significant differences' : 'Similar governance values',
          href: `/drep/${encodeURIComponent(viewerDrepId)}`,
          icon: 'user',
          personalized: true,
        });
      }
    } else {
      connections.push({
        label: 'Your DRep',
        sublabel: 'Compare governance records',
        href: `/drep/${encodeURIComponent(viewerDrepId)}`,
        icon: 'user',
        personalized: true,
      });
    }
  }

  // Delegation stats
  if (drep.delegatorCount != null && drep.delegatorCount > 0) {
    const ada = drep.votingPowerLovelace
      ? `${formatAdaShort(Number(drep.votingPowerLovelace))}`
      : '';
    connections.push({
      label: `${drep.delegatorCount} delegators`,
      sublabel: ada ? `${ada} delegated` : undefined,
      href: `/workspace/delegators`,
      icon: 'users',
      personalized: false,
    });
  }

  // Recent proposals voted on (up to 3) — with proposal titles
  const recentVotes = votes.slice(0, 3);
  if (recentVotes.length > 0) {
    const proposalIds = recentVotes.map((v) => ({
      txHash: v.proposal_tx_hash,
      index: v.proposal_index,
    }));
    const proposalMap = await getProposalsByIds(proposalIds);

    for (const vote of recentVotes) {
      const proposal = proposalMap.get(vote.proposal_tx_hash);
      connections.push({
        label: `Voted ${vote.vote}`,
        sublabel:
          proposal?.title?.slice(0, 45) ??
          `Proposal ${vote.proposal_tx_hash.slice(0, 8)}...#${vote.proposal_index}`,
        href: `/proposal/${vote.proposal_tx_hash}/${vote.proposal_index}`,
        icon: 'vote',
        personalized: false,
      });
    }
  }

  // Score context
  if (drep.drepScore != null) {
    const momentum = drep.scoreMomentum ?? 0;
    const arrow = momentum > 1 ? ' ↑' : momentum < -1 ? ' ↓' : '';
    connections.push({
      label: `Score: ${Math.round(drep.drepScore)}${arrow}`,
      sublabel: momentum > 1 ? 'Trending up' : momentum < -1 ? 'Trending down' : 'Stable',
      href: `/you/drep`,
      icon: 'trending',
      personalized: false,
    });
  }

  return connections.slice(0, 10);
}

// ── Proposal Connections ──────────────────────────────────────────────────

async function getProposalConnections(
  compositeId: string,
  context?: ConnectionContext,
): Promise<EntityConnection[]> {
  const connections: EntityConnection[] = [];
  const viewerDrepId = context?.viewerDrepId;

  const parts = compositeId.split('/');
  if (parts.length !== 2) return connections;
  const [txHash, indexStr] = parts;
  const proposalIndex = Number(indexStr);

  const [proposal, drepVotes, spoVotes, ccVotes, similar] = await Promise.all([
    getProposalByKey(txHash, proposalIndex),
    getVotesByProposal(txHash, proposalIndex),
    getSpoVotesByProposal(txHash, proposalIndex),
    getCcVotesByProposal(txHash, proposalIndex),
    findSimilarByClassification(txHash, proposalIndex, 3),
  ]);

  // Viewer's DRep vote (personalized)
  if (viewerDrepId) {
    const viewerVote = drepVotes.find((v) => v.drepId === viewerDrepId);
    if (viewerVote) {
      connections.push({
        label: `Your DRep voted ${viewerVote.vote}`,
        sublabel: viewerVote.drepName ?? viewerDrepId.slice(0, 12),
        href: `/drep/${encodeURIComponent(viewerDrepId)}`,
        icon: 'user',
        personalized: true,
      });
    }
  }

  // Treasury impact (for treasury withdrawal proposals)
  if (proposal?.proposalType === 'TreasuryWithdrawals' && proposal.withdrawalAmount) {
    const treasury = await getTreasuryBalance();
    const amountAda = proposal.withdrawalAmount / 1_000_000;
    const pct =
      treasury?.balanceAda && treasury.balanceAda > 0
        ? ((amountAda / treasury.balanceAda) * 100).toFixed(1)
        : null;
    connections.push({
      label: `Requests ${formatAdaShort(proposal.withdrawalAmount)}`,
      sublabel: pct ? `${pct}% of treasury` : undefined,
      href: '/governance/treasury',
      icon: 'trending',
      personalized: false,
    });
  }

  // Proposal type context — "why this matters"
  if (proposal?.proposalType) {
    const typeContext = getProposalTypeContext(proposal.proposalType);
    if (typeContext) {
      connections.push({
        label: typeContext.label,
        sublabel: typeContext.sublabel,
        href: `/proposal/${txHash}/${proposalIndex}`,
        icon: 'link',
        personalized: false,
      });
    }
  }

  // Vote breakdown
  const yesCount = proposal?.yesCount ?? drepVotes.filter((v) => v.vote === 'Yes').length;
  const noCount = proposal?.noCount ?? drepVotes.filter((v) => v.vote === 'No').length;
  const abstainCount =
    proposal?.abstainCount ?? drepVotes.filter((v) => v.vote === 'Abstain').length;
  connections.push({
    label: `${yesCount} Yes / ${noCount} No / ${abstainCount} Abstain`,
    sublabel: `${drepVotes.length} DReps voted`,
    href: `/proposal/${txHash}/${proposalIndex}`,
    icon: 'vote',
    personalized: false,
  });

  // SPO participation
  if (spoVotes.length > 0) {
    connections.push({
      label: `${spoVotes.length} SPOs voted`,
      href: `/proposal/${txHash}/${proposalIndex}`,
      icon: 'building',
      personalized: false,
    });
  }

  // CC ruling
  if (ccVotes.length > 0) {
    const ccYes = ccVotes.filter((v) => v.vote === 'Yes').length;
    const ccNo = ccVotes.filter((v) => v.vote === 'No').length;
    connections.push({
      label: `CC: ${ccYes} Yes / ${ccNo} No`,
      sublabel: `${ccVotes.length} members voted`,
      href: `/governance/committee`,
      icon: 'shield',
      personalized: false,
    });
  }

  // Similar proposals
  for (const sim of similar) {
    connections.push({
      label: sim.title?.slice(0, 50) ?? 'Related proposal',
      sublabel: `${Math.round(sim.similarityScore * 100)}% similar`,
      href: `/proposal/${sim.txHash}/${sim.index}`,
      icon: 'file-text',
      personalized: false,
    });
  }

  return connections.slice(0, 10);
}

// ── Pool Connections ──────────────────────────────────────────────────────

async function getPoolConnections(poolId: string): Promise<EntityConnection[]> {
  const connections: EntityConnection[] = [];
  const supabase = getSupabaseAdmin();

  const { data: pool } = await supabase
    .from('pools')
    .select('pool_id, pool_name, governance_score, active_stake')
    .eq('pool_id', poolId)
    .maybeSingle();

  if (!pool) return connections;

  if (pool.governance_score != null) {
    connections.push({
      label: `Gov Score: ${Math.round(pool.governance_score)}`,
      href: `/pool/${encodeURIComponent(poolId)}`,
      icon: 'trending',
      personalized: false,
    });
  }

  // Recent votes with proposal titles
  const { data: poolVotes } = await supabase
    .from('spo_votes')
    .select('proposal_tx_hash, proposal_index, vote')
    .eq('pool_id', poolId)
    .order('block_time', { ascending: false })
    .limit(5);

  if (poolVotes && poolVotes.length > 0) {
    const proposalIds = poolVotes.map((v) => ({
      txHash: v.proposal_tx_hash,
      index: v.proposal_index,
    }));
    const proposalMap = await getProposalsByIds(proposalIds);

    for (const vote of poolVotes.slice(0, 3)) {
      const proposal = proposalMap.get(vote.proposal_tx_hash);
      connections.push({
        label: `Voted ${vote.vote}`,
        sublabel:
          proposal?.title?.slice(0, 40) ?? `Proposal ${vote.proposal_tx_hash.slice(0, 8)}...`,
        href: `/proposal/${vote.proposal_tx_hash}/${vote.proposal_index}`,
        icon: 'vote',
        personalized: false,
      });
    }
  }

  // Similar pools
  if (pool.governance_score != null) {
    const { data: similarPools } = await supabase
      .from('pools')
      .select('pool_id, pool_name, governance_score')
      .neq('pool_id', poolId)
      .gte('governance_score', pool.governance_score - 10)
      .lte('governance_score', pool.governance_score + 10)
      .order('governance_score', { ascending: false })
      .limit(3);

    for (const sim of similarPools ?? []) {
      connections.push({
        label: sim.pool_name ?? sim.pool_id.slice(0, 12),
        sublabel: `Score: ${Math.round(sim.governance_score)}`,
        href: `/pool/${encodeURIComponent(sim.pool_id)}`,
        icon: 'building',
        personalized: false,
      });
    }
  }

  return connections.slice(0, 10);
}

// ── CC Member Connections ─────────────────────────────────────────────────

async function getCCConnections(ccHotId: string): Promise<EntityConnection[]> {
  const connections: EntityConnection[] = [];

  const [fidelityHistory, allMembers] = await Promise.all([
    getCCFidelityHistory(ccHotId),
    getCCMembersFidelity(),
  ]);

  const thisMember = allMembers.find((m) => m.ccHotId === ccHotId);

  if (thisMember?.fidelityScore != null) {
    connections.push({
      label: `Fidelity: ${Math.round(thisMember.fidelityScore)}`,
      sublabel: thisMember.fidelityGrade ?? undefined,
      href: `/governance/committee/${encodeURIComponent(ccHotId)}`,
      icon: 'shield',
      personalized: false,
    });
  }

  if (
    thisMember?.votesCast != null &&
    thisMember?.eligibleProposals != null &&
    thisMember.eligibleProposals > 0
  ) {
    const rate = Math.round((thisMember.votesCast / thisMember.eligibleProposals) * 100);
    connections.push({
      label: `${rate}% participation`,
      sublabel: `${thisMember.votesCast} of ${thisMember.eligibleProposals} votes`,
      href: `/governance/committee/${encodeURIComponent(ccHotId)}`,
      icon: 'vote',
      personalized: false,
    });
  }

  const otherMembers = allMembers.filter((m) => m.ccHotId !== ccHotId).slice(0, 3);
  for (const member of otherMembers) {
    connections.push({
      label: member.authorName ?? member.ccHotId.slice(0, 12),
      sublabel:
        member.fidelityScore != null ? `Fidelity: ${Math.round(member.fidelityScore)}` : undefined,
      href: `/governance/committee/${encodeURIComponent(member.ccHotId)}`,
      icon: 'shield',
      personalized: false,
    });
  }

  if (fidelityHistory.length >= 2) {
    const latest = fidelityHistory[0];
    const prev = fidelityHistory[1];
    if (latest?.fidelityScore != null && prev?.fidelityScore != null) {
      const delta = latest.fidelityScore - prev.fidelityScore;
      if (Math.abs(delta) >= 1) {
        connections.push({
          label: delta > 0 ? 'Fidelity improving' : 'Fidelity declining',
          sublabel: `${delta > 0 ? '+' : ''}${delta.toFixed(1)} since last epoch`,
          href: `/governance/committee/${encodeURIComponent(ccHotId)}`,
          icon: 'trending',
          personalized: false,
        });
      }
    }
  }

  return connections.slice(0, 10);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatAdaShort(lovelace: number): string {
  const ada = lovelace / 1_000_000;
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B ₳`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(0)}M ₳`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(1)}K ₳`;
  return `${Math.round(ada)} ₳`;
}

function getProposalTypeContext(type: string): { label: string; sublabel: string } | null {
  switch (type) {
    case 'HardForkInitiation':
      return {
        label: 'Critical: Hard Fork',
        sublabel: 'Major protocol upgrade affecting all users',
      };
    case 'NoConfidence':
      return {
        label: 'Critical: No Confidence',
        sublabel: 'Motion to replace the Constitutional Committee',
      };
    case 'NewConstitution':
    case 'UpdateConstitution':
      return {
        label: 'Critical: Constitution Change',
        sublabel: 'Amends the foundational governance document',
      };
    case 'ParameterChange':
      return {
        label: 'Parameter Change',
        sublabel: 'Modifies protocol parameters (fees, rewards, etc.)',
      };
    case 'TreasuryWithdrawals':
      return null; // Handled separately with amount
    default:
      return null;
  }
}
