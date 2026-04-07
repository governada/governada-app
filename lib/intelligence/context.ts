/**
 * Contextual AI Synthesis — the Co-Pilot brain.
 *
 * Given a page path and optional user context, produces an AI-synthesized
 * contextual briefing. Uses shared server read services plus
 * route-local personalization when a user context is available.
 *
 * Route-specific synthesis:
 * - Proposal page: constitutional concerns + community sentiment + precedent
 * - DRep page: alignment match + score trajectory + key divergences
 * - Hub: personalized governance briefing + priority actions
 * - List pages: trending signals + personalized highlights
 */

import { createClient } from '@/lib/supabase';
import { parseRoutePath } from '@/lib/entity/entityId';
import { fetchGovernanceProposalContextSeed } from '@/lib/governance/proposalContext';
import { fetchGovernanceTreasuryContext } from '@/lib/governance/treasuryContext';
import { logger } from '@/lib/logger';
import { cached } from '@/lib/redis';
import { getCurrentEpoch } from '@/lib/constants';
import {
  getNclUtilization,
  getDRepTreasuryTrackRecord,
  formatAda,
  calculateRunwayMonths,
} from '@/lib/treasury';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextSynthesisInput {
  pathname: string;
  stakeAddress?: string;
  entityId?: string;
}

export interface ContextSynthesisResult {
  /** The synthesized briefing text */
  briefing: string;
  /** Key data points extracted for structured display */
  highlights: ContextHighlight[];
  /** Suggested actions for the user */
  suggestedActions: SuggestedAction[];
  /** Route type that was detected */
  routeType: RouteType;
  /** When this was computed */
  computedAt: string;
}

export interface ContextHighlight {
  label: string;
  value: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface SuggestedAction {
  label: string;
  href: string;
  priority: 'high' | 'medium' | 'low';
}

type RouteType =
  | 'proposal'
  | 'drep'
  | 'hub'
  | 'proposals-list'
  | 'representatives-list'
  | 'health'
  | 'treasury'
  | 'workspace'
  | 'governance'
  | 'list'
  | 'unknown';

// ---------------------------------------------------------------------------
// Route detection
// ---------------------------------------------------------------------------

interface ParsedRoute {
  type: RouteType;
  entityId?: string;
}

function parseRoute(pathname: string): ParsedRoute {
  const entityRoute = parseRoutePath(pathname);
  if (entityRoute?.type === 'proposal') {
    return {
      type: 'proposal',
      entityId: `${entityRoute.id}#${entityRoute.secondaryId ?? '0'}`,
    };
  }
  if (entityRoute?.type === 'drep') {
    return { type: 'drep', entityId: entityRoute.id };
  }

  // Legacy proposal path: /proposals/[txHash]-[index]
  const proposalMatch = pathname.match(/\/proposals\/([a-f0-9]+)-?(\d+)?/);
  if (proposalMatch) {
    return {
      type: 'proposal',
      entityId: proposalMatch[2] ? `${proposalMatch[1]}#${proposalMatch[2]}` : proposalMatch[1],
    };
  }

  // Legacy DRep path: /dreps/[drepId]
  const drepMatch = pathname.match(/\/dreps\/([^/]+)/);
  if (drepMatch) {
    return { type: 'drep', entityId: decodeURIComponent(drepMatch[1]) };
  }

  // Specific governance sub-pages
  if (pathname === '/governance/proposals' || pathname === '/proposals') {
    return { type: 'proposals-list' };
  }
  if (
    pathname === '/governance/representatives' ||
    pathname === '/representatives' ||
    pathname === '/dreps'
  ) {
    return { type: 'representatives-list' };
  }
  if (pathname === '/governance/health') {
    return { type: 'health' };
  }
  if (pathname === '/governance/treasury') {
    return { type: 'treasury' };
  }
  if (pathname.startsWith('/workspace')) {
    return { type: 'workspace' };
  }

  // Generic governance pages
  if (pathname.startsWith('/governance')) {
    return { type: 'governance' };
  }

  // Hub / home
  if (pathname === '/' || pathname === '/hub') {
    return { type: 'hub' };
  }

  return { type: 'unknown' };
}

// ---------------------------------------------------------------------------
// Synthesis implementations per route
// ---------------------------------------------------------------------------

async function synthesizeProposalContext(
  proposalId: string,
  stakeAddress?: string,
): Promise<ContextSynthesisResult> {
  const supabase = createClient();

  const seed = await fetchGovernanceProposalContextSeed(supabase, proposalId);
  if (!seed) {
    return emptyResult('proposal');
  }

  const { proposal, voting, classification } = seed;

  const yes = voting.drep.yes;
  const no = voting.drep.no;
  const abstain = voting.drep.abstain;
  const total = yes + no + abstain;

  const highlights: ContextHighlight[] = [];
  const suggestedActions: SuggestedAction[] = [];

  // Vote sentiment
  if (total > 0) {
    const yesPct = Math.round((yes / total) * 100);
    highlights.push({
      label: 'DRep Sentiment',
      value: `${yesPct}% Yes (${total} votes)`,
      sentiment: yesPct > 60 ? 'positive' : yesPct < 40 ? 'negative' : 'neutral',
    });
  }

  // Treasury impact
  if (proposal.withdrawalAmount) {
    const adaAmount = Math.round(Number(proposal.withdrawalAmount) / 1_000_000);
    highlights.push({
      label: 'Treasury Impact',
      value: `${adaAmount.toLocaleString()} ADA`,
      sentiment: adaAmount > 10_000_000 ? 'negative' : 'neutral',
    });
  }

  // Constitutional classification strength
  if (classification) {
    highlights.push({
      label: 'Alignment Signal',
      value: classification.strength === 'strong' ? 'Strong' : 'Moderate',
      sentiment: 'neutral',
    });
  }

  // Expiration
  if (proposal.expirationEpoch) {
    const epochsRemaining = voting.epochsRemaining ?? proposal.expirationEpoch - getCurrentEpoch();
    if (epochsRemaining <= 2 && epochsRemaining > 0) {
      highlights.push({
        label: 'Expiration',
        value: `${epochsRemaining} epoch${epochsRemaining === 1 ? '' : 's'} remaining`,
        sentiment: epochsRemaining <= 1 ? 'negative' : 'neutral',
      });
    }
  }

  // Treasury context for withdrawal proposals
  if (proposal.withdrawalAmount) {
    const withdrawalAda = Math.round(Number(proposal.withdrawalAmount) / 1_000_000);
    const treasury = await fetchGovernanceTreasuryContext().catch(() => null);
    if (treasury?.treasuryData) {
      // Runway impact
      const currentRunway = treasury.runwayMonths;
      if (currentRunway > 0 && withdrawalAda > 0) {
        const impactMonths = Math.round(
          currentRunway -
            calculateRunwayMonths(
              treasury.treasuryData.balanceAda - withdrawalAda,
              treasury.treasuryData.balanceAda > 0
                ? (treasury.treasuryData.balanceAda -
                    (treasury.treasuryData.balanceAda - withdrawalAda)) /
                    (currentRunway / 12)
                : 0,
            ),
        );
        if (impactMonths > 0) {
          highlights.push({
            label: 'Runway Impact',
            value: `-${impactMonths}mo`,
            sentiment: impactMonths > 6 ? 'negative' : 'neutral',
          });
        }
      }
    }
    if (treasury?.ncl) {
      const newUtilization =
        treasury.ncl.utilizationPct +
        (withdrawalAda / (treasury.ncl.remainingAda + withdrawalAda)) * 100;
      highlights.push({
        label: 'NCL Impact',
        value: `Budget → ${Math.round(Math.min(100, newUtilization))}%`,
        sentiment: newUtilization > 75 ? 'negative' : newUtilization > 50 ? 'neutral' : 'positive',
      });
    }
  } else {
    // Non-treasury proposal: lighter treasury status
    const treasury = await fetchGovernanceTreasuryContext().catch(() => null);
    if (treasury?.treasuryData) {
      const healthy = treasury.runwayMonths > 24;
      highlights.push({
        label: 'Treasury',
        value: healthy ? 'Healthy' : 'Needs Attention',
        sentiment: healthy ? 'positive' : 'negative',
      });
    }
  }

  // Build briefing text
  const briefingParts: string[] = [];
  briefingParts.push(
    `${proposal.title || 'Untitled Proposal'} is a ${proposal.proposalType} proposal.`,
  );
  if (proposal.aiSummary) {
    briefingParts.push(proposal.aiSummary);
  }
  if (total > 0) {
    const yesPct = Math.round((yes / total) * 100);
    briefingParts.push(`Current voting: ${yesPct}% in favor across ${total} DRep votes.`);
  }

  // Suggested actions for authenticated users
  if (stakeAddress) {
    suggestedActions.push({
      label: 'View Full Analysis',
      href: `/proposal/${proposal.txHash}/${proposal.proposalIndex}`,
      priority: 'medium',
    });
  }

  return {
    briefing: briefingParts.join(' '),
    highlights,
    suggestedActions,
    routeType: 'proposal',
    computedAt: new Date().toISOString(),
  };
}

async function synthesizeDrepContext(
  drepId: string,
  stakeAddress?: string,
): Promise<ContextSynthesisResult> {
  const supabase = createClient();

  const { data: drep } = await supabase
    .from('dreps')
    .select(
      'id, score, info, size_tier, effective_participation, rationale_rate, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency, score_momentum',
    )
    .eq('id', drepId)
    .maybeSingle();

  if (!drep) {
    return emptyResult('drep');
  }

  const info = (drep.info ?? {}) as Record<string, unknown>;
  const name = (info.name as string) || drepId.slice(0, 16);
  const highlights: ContextHighlight[] = [];
  const suggestedActions: SuggestedAction[] = [];

  // Score
  highlights.push({
    label: 'DRep Score',
    value: `${drep.score}/100`,
    sentiment: drep.score >= 70 ? 'positive' : drep.score >= 40 ? 'neutral' : 'negative',
  });

  // Participation
  if (drep.effective_participation != null) {
    highlights.push({
      label: 'Participation',
      value: `${Math.round(drep.effective_participation)}%`,
      sentiment:
        drep.effective_participation >= 70
          ? 'positive'
          : drep.effective_participation >= 40
            ? 'neutral'
            : 'negative',
    });
  }

  // Score momentum
  if (drep.score_momentum != null) {
    const direction =
      drep.score_momentum > 0.5 ? 'Rising' : drep.score_momentum < -0.5 ? 'Falling' : 'Stable';
    highlights.push({
      label: 'Trend',
      value: direction,
      sentiment:
        direction === 'Rising' ? 'positive' : direction === 'Falling' ? 'negative' : 'neutral',
    });
  }

  // Size tier
  highlights.push({
    label: 'Size',
    value: drep.size_tier ?? 'Unknown',
    sentiment: 'neutral',
  });

  // Alignment match (if authenticated user)
  if (stakeAddress) {
    // Check if user has alignment data
    const { data: userDrep } = await supabase
      .from('dreps')
      .select(
        'alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
      )
      .eq('id', stakeAddress)
      .maybeSingle();

    if (userDrep) {
      const userVec = [
        userDrep.alignment_treasury_conservative ?? 50,
        userDrep.alignment_treasury_growth ?? 50,
        userDrep.alignment_decentralization ?? 50,
        userDrep.alignment_security ?? 50,
        userDrep.alignment_innovation ?? 50,
        userDrep.alignment_transparency ?? 50,
      ];
      const drepVec = [
        drep.alignment_treasury_conservative ?? 50,
        drep.alignment_treasury_growth ?? 50,
        drep.alignment_decentralization ?? 50,
        drep.alignment_security ?? 50,
        drep.alignment_innovation ?? 50,
        drep.alignment_transparency ?? 50,
      ];
      const match = cosineDistance(userVec, drepVec);
      highlights.push({
        label: 'Alignment Match',
        value: `${Math.round(match * 100)}%`,
        sentiment: match > 0.7 ? 'positive' : match > 0.4 ? 'neutral' : 'negative',
      });
    }
  }

  // Treasury track record
  const treasuryRecord = await getDRepTreasuryTrackRecord(drepId).catch(() => null);
  if (treasuryRecord && treasuryRecord.totalProposals > 0) {
    const stance =
      treasuryRecord.approvedAda > treasuryRecord.opposedAda * 2
        ? 'Growth'
        : treasuryRecord.opposedAda > treasuryRecord.approvedAda * 2
          ? 'Conservative'
          : 'Balanced';
    highlights.push({
      label: 'Treasury Stance',
      value: stance,
      sentiment: 'neutral',
    });
    highlights.push({
      label: 'Treasury Votes',
      value: `${treasuryRecord.totalProposals} (${formatAda(treasuryRecord.approvedAda)} approved)`,
      sentiment: 'neutral',
    });
  }

  const briefing = `${name} is a ${drep.size_tier ?? ''} DRep with a score of ${drep.score}/100. Participation rate: ${Math.round(drep.effective_participation ?? 0)}%. Rationale rate: ${Math.round(drep.rationale_rate ?? 0)}%.`;

  return {
    briefing,
    highlights,
    suggestedActions,
    routeType: 'drep',
    computedAt: new Date().toISOString(),
  };
}

async function synthesizeHubContext(stakeAddress?: string): Promise<ContextSynthesisResult> {
  const supabase = createClient();

  const highlights: ContextHighlight[] = [];
  const suggestedActions: SuggestedAction[] = [];

  // Get basic governance stats
  const [openCount, govStats] = await Promise.all([
    supabase
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null),
    supabase.from('governance_stats').select('*').eq('id', 1).single(),
  ]);

  const activeProposals = openCount.count ?? 0;
  highlights.push({
    label: 'Active Proposals',
    value: String(activeProposals),
    sentiment: activeProposals > 10 ? 'negative' : 'neutral',
  });

  if (govStats.data) {
    const stats = govStats.data as Record<string, unknown>;
    if (stats.current_epoch) {
      highlights.push({
        label: 'Current Epoch',
        value: String(stats.current_epoch),
        sentiment: 'neutral',
      });
    }
  }

  // Treasury awareness
  const treasury = await fetchGovernanceTreasuryContext().catch(() => null);
  if (treasury?.treasuryData) {
    const runwayYears = treasury.runwayMonths / 12;
    const runwayLabel =
      runwayYears > 20 ? '10+ yr runway' : `${Math.round(treasury.runwayMonths)}mo runway`;
    const healthy = treasury.runwayMonths > 24;
    highlights.push({
      label: 'Treasury',
      value: `${healthy ? 'Healthy' : 'Attention'} · ${runwayLabel}`,
      sentiment: healthy ? 'positive' : 'negative',
    });
  }

  // Pending treasury proposals action
  const pendingTreasuryResult = await supabase
    .from('proposals')
    .select('*', { count: 'exact', head: true })
    .is('ratified_epoch', null)
    .is('enacted_epoch', null)
    .is('dropped_epoch', null)
    .is('expired_epoch', null)
    .not('withdrawal_amount', 'is', null);
  const pendingTreasuryCount = pendingTreasuryResult.count ?? 0;
  if (pendingTreasuryCount > 0) {
    suggestedActions.push({
      label: `Review ${pendingTreasuryCount} treasury proposal${pendingTreasuryCount !== 1 ? 's' : ''}`,
      href: '/governance/treasury',
      priority: 'high',
    });
  }

  if (stakeAddress) {
    suggestedActions.push({
      label: 'Review Your Inbox',
      href: '/governance/inbox',
      priority: 'high',
    });
  }

  suggestedActions.push({
    label: 'Browse Active Proposals',
    href: '/proposals',
    priority: 'medium',
  });

  const briefing = `${activeProposals} governance proposal${activeProposals === 1 ? ' is' : 's are'} currently active on the Cardano network.`;

  return {
    briefing,
    highlights,
    suggestedActions,
    routeType: 'hub',
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Proposals List — voting urgency, controversial proposals, treasury patterns
// ---------------------------------------------------------------------------

async function synthesizeProposalsListContext(
  stakeAddress?: string,
): Promise<ContextSynthesisResult> {
  const supabase = createClient();

  const highlights: ContextHighlight[] = [];
  const suggestedActions: SuggestedAction[] = [];

  // Parallel: active proposals with details, recent outcomes, treasury stats
  const [activeResult, recentOutcomes, treasuryProposals] = await Promise.all([
    supabase
      .from('proposals')
      .select('tx_hash, proposal_index, title, proposal_type, withdrawal_amount, expiration_epoch')
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null)
      .order('proposed_epoch', { ascending: false })
      .limit(50),
    supabase
      .from('proposals')
      .select('proposal_type, ratified_epoch, dropped_epoch, expired_epoch')
      .not('ratified_epoch', 'is', null)
      .order('ratified_epoch', { ascending: false })
      .limit(30),
    supabase
      .from('proposals')
      .select('tx_hash, withdrawal_amount')
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null)
      .not('withdrawal_amount', 'is', null),
  ]);

  const active = activeResult.data ?? [];
  const outcomes = recentOutcomes.data ?? [];
  const treasury = treasuryProposals.data ?? [];

  // Current epoch estimate
  const currentEpoch = getCurrentEpoch();

  // Active proposal count
  highlights.push({
    label: 'Active Proposals',
    value: String(active.length),
    sentiment: active.length > 10 ? 'negative' : 'neutral',
  });

  // Proposals expiring soon
  const expiringSoon = active.filter(
    (p) => p.expiration_epoch && p.expiration_epoch - currentEpoch <= 2,
  );
  if (expiringSoon.length > 0) {
    highlights.push({
      label: 'Expiring Soon',
      value: `${expiringSoon.length} proposal${expiringSoon.length !== 1 ? 's' : ''}`,
      sentiment: 'negative',
    });
  }

  // Treasury exposure
  const totalTreasuryAda = treasury.reduce(
    (sum, p) => sum + Math.round(Number(p.withdrawal_amount ?? 0) / 1_000_000),
    0,
  );
  if (totalTreasuryAda > 0) {
    highlights.push({
      label: 'Treasury at Stake',
      value: `${totalTreasuryAda.toLocaleString()} ADA`,
      sentiment: totalTreasuryAda > 50_000_000 ? 'negative' : 'neutral',
    });
  }

  // NCL utilization context
  const nclData = await getNclUtilization().catch(() => null);
  if (nclData && totalTreasuryAda > 0) {
    const projectedIfAllPass =
      nclData.utilizationPct + (totalTreasuryAda / (nclData.remainingAda + totalTreasuryAda)) * 100;
    highlights.push({
      label: 'NCL Budget',
      value: `${Math.round(nclData.utilizationPct)}% used, ${Math.round(Math.min(100, projectedIfAllPass))}% if all pass`,
      sentiment:
        projectedIfAllPass > 75 ? 'negative' : projectedIfAllPass > 50 ? 'neutral' : 'positive',
    });
  }

  // Proposal type breakdown
  const typeCounts: Record<string, number> = {};
  for (const p of active) {
    const t = p.proposal_type ?? 'Other';
    typeCounts[t] = (typeCounts[t] ?? 0) + 1;
  }
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
  if (topType && active.length > 2) {
    highlights.push({
      label: 'Most Common',
      value: `${topType[0]} (${topType[1]})`,
      sentiment: 'neutral',
    });
  }

  // Recent pass rate
  if (outcomes.length >= 5) {
    const ratified = outcomes.filter((o) => o.ratified_epoch != null).length;
    const passRate = Math.round((ratified / outcomes.length) * 100);
    highlights.push({
      label: 'Recent Pass Rate',
      value: `${passRate}%`,
      sentiment: passRate > 70 ? 'positive' : passRate < 30 ? 'negative' : 'neutral',
    });
  }

  // Build briefing
  const briefingParts: string[] = [];
  briefingParts.push(`${active.length} proposals are currently active.`);
  if (expiringSoon.length > 0) {
    briefingParts.push(
      `${expiringSoon.length} expire${expiringSoon.length === 1 ? 's' : ''} within 2 epochs — review before they lapse.`,
    );
  }
  if (totalTreasuryAda > 0) {
    briefingParts.push(
      `${treasury.length} treasury withdrawal${treasury.length !== 1 ? 's' : ''} totaling ${totalTreasuryAda.toLocaleString()} ADA are pending — ${totalTreasuryAda > 50_000_000 ? 'significant treasury exposure' : 'moderate treasury impact'}.`,
    );
  }
  if (topType && active.length > 3) {
    briefingParts.push(`${topType[0]} proposals dominate the current batch.`);
  }

  // Suggested actions
  if (expiringSoon.length > 0) {
    suggestedActions.push({
      label: `Review ${expiringSoon.length} expiring proposal${expiringSoon.length !== 1 ? 's' : ''}`,
      href: '/governance/proposals',
      priority: 'high',
    });
  }
  if (stakeAddress) {
    suggestedActions.push({
      label: 'Check your alignment with active proposals',
      href: '/match',
      priority: 'medium',
    });
  }

  return {
    briefing: briefingParts.join(' '),
    highlights,
    suggestedActions,
    routeType: 'proposals-list',
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Representatives List — top performers, score movers, delegation insights
// ---------------------------------------------------------------------------

async function synthesizeRepresentativesListContext(
  stakeAddress?: string,
): Promise<ContextSynthesisResult> {
  const supabase = createClient();

  const highlights: ContextHighlight[] = [];
  const suggestedActions: SuggestedAction[] = [];

  // Parallel: DRep stats, top movers, ecosystem health
  const [drepCount, topDreps, recentMovers] = await Promise.all([
    supabase.from('dreps').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase
      .from('dreps')
      .select('id, score, info, effective_participation, rationale_rate, size_tier, score_momentum')
      .eq('is_active', true)
      .order('score', { ascending: false })
      .limit(10),
    supabase
      .from('dreps')
      .select('id, score, info, score_momentum')
      .eq('is_active', true)
      .not('score_momentum', 'is', null)
      .order('score_momentum', { ascending: false })
      .limit(5),
  ]);

  const activeDrepCount = drepCount.count ?? 0;
  const top = topDreps.data ?? [];
  const movers = recentMovers.data ?? [];

  highlights.push({
    label: 'Active DReps',
    value: String(activeDrepCount),
    sentiment: activeDrepCount > 50 ? 'positive' : 'neutral',
  });

  // Average top-10 participation
  if (top.length > 0) {
    const avgPart = Math.round(
      top.reduce((sum, d) => sum + (d.effective_participation ?? 0), 0) / top.length,
    );
    highlights.push({
      label: 'Top 10 Avg Participation',
      value: `${avgPart}%`,
      sentiment: avgPart >= 70 ? 'positive' : avgPart >= 50 ? 'neutral' : 'negative',
    });
  }

  // Average rationale rate across top DReps
  if (top.length > 0) {
    const avgRationale = Math.round(
      top.reduce((sum, d) => sum + (d.rationale_rate ?? 0), 0) / top.length,
    );
    highlights.push({
      label: 'Top 10 Rationale Rate',
      value: `${avgRationale}%`,
      sentiment: avgRationale >= 60 ? 'positive' : avgRationale >= 30 ? 'neutral' : 'negative',
    });
  }

  // Biggest mover
  const topMover = movers[0];
  if (topMover && topMover.score_momentum && topMover.score_momentum > 1) {
    const moverInfo = (topMover.info ?? {}) as Record<string, unknown>;
    const moverName = (moverInfo.name as string) || topMover.id.slice(0, 12);
    highlights.push({
      label: 'Top Mover',
      value: `${moverName} (+${topMover.score_momentum.toFixed(1)})`,
      sentiment: 'positive',
    });
  }

  // Size distribution
  if (top.length > 0) {
    const sizeCounts: Record<string, number> = {};
    for (const d of top) {
      const tier = d.size_tier ?? 'Unknown';
      sizeCounts[tier] = (sizeCounts[tier] ?? 0) + 1;
    }
    const dominant = Object.entries(sizeCounts).sort((a, b) => b[1] - a[1])[0];
    if (dominant) {
      highlights.push({
        label: 'Top 10 Profile',
        value: `${dominant[1]}/10 are ${dominant[0]}`,
        sentiment: 'neutral',
      });
    }
  }

  // Build briefing
  const briefingParts: string[] = [];
  briefingParts.push(`${activeDrepCount} DReps are currently active in governance.`);
  if (top.length > 0) {
    const topName = ((top[0].info ?? {}) as Record<string, unknown>).name as string | undefined;
    briefingParts.push(`Top scorer: ${topName || top[0].id.slice(0, 12)} at ${top[0].score}/100.`);
  }
  if (topMover && topMover.score_momentum && topMover.score_momentum > 1) {
    briefingParts.push(
      `Notable momentum: some DReps are rising fast through active participation.`,
    );
  }

  // User-specific: check if their DRep is in the top 10
  if (stakeAddress) {
    const { data: holder } = await supabase
      .from('governance_holders')
      .select('delegated_drep_id')
      .eq('stake_address', stakeAddress)
      .maybeSingle();

    if (holder?.delegated_drep_id) {
      const userDrepInTop = top.find((d) => d.id === holder.delegated_drep_id);
      if (userDrepInTop) {
        const rank = top.indexOf(userDrepInTop) + 1;
        briefingParts.push(`Your DRep ranks #${rank} overall — strong representation.`);
        highlights.push({
          label: 'Your DRep Rank',
          value: `#${rank}`,
          sentiment: 'positive',
        });
      } else {
        suggestedActions.push({
          label: 'Compare your DRep with top performers',
          href: '/match',
          priority: 'medium',
        });
      }
    }
  }

  suggestedActions.push({
    label: 'Explore all DReps',
    href: '/governance/representatives',
    priority: 'low',
  });

  return {
    briefing: briefingParts.join(' '),
    highlights,
    suggestedActions,
    routeType: 'representatives-list',
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Health Page — GHI component analysis, cross-body dynamics, trends
// ---------------------------------------------------------------------------

async function synthesizeHealthContext(stakeAddress?: string): Promise<ContextSynthesisResult> {
  const supabase = createClient();

  const highlights: ContextHighlight[] = [];
  const suggestedActions: SuggestedAction[] = [];

  // Parallel: GHI, inter-body alignment, DRep participation
  const [ghiResult, interBodyResult, drepStats] = await Promise.all([
    supabase
      .from('governance_health_index')
      .select('score, components, computed_at, edi_score')
      .order('computed_at', { ascending: false })
      .limit(2),
    supabase
      .from('inter_body_alignment')
      .select('alignment_score, proposal_tx_hash')
      .order('computed_at', { ascending: false })
      .limit(20),
    supabase
      .from('dreps')
      .select('effective_participation, rationale_rate, score')
      .eq('is_active', true),
  ]);

  const ghiRows = ghiResult.data ?? [];
  const currentGhi = ghiRows[0];
  const previousGhi = ghiRows[1];
  const alignments = interBodyResult.data ?? [];
  const dreps = drepStats.data ?? [];

  // GHI score + trend
  if (currentGhi) {
    const score = Math.round(currentGhi.score);
    highlights.push({
      label: 'GHI Score',
      value: `${score}/100`,
      sentiment: score >= 70 ? 'positive' : score >= 50 ? 'neutral' : 'negative',
    });

    if (previousGhi) {
      const delta = Math.round(currentGhi.score - previousGhi.score);
      if (delta !== 0) {
        highlights.push({
          label: 'GHI Trend',
          value: `${delta > 0 ? '+' : ''}${delta} since last period`,
          sentiment: delta > 0 ? 'positive' : 'negative',
        });
      }
    }

    // Weakest component
    const components = (currentGhi.components ?? []) as Array<{
      name: string;
      value: number;
      weight: number;
    }>;
    const activeComps = components.filter((c) => c.weight > 0);
    const weakest = activeComps.reduce((min, c) => (c.value < min.value ? c : min), activeComps[0]);
    const strongest = activeComps.reduce(
      (max, c) => (c.value > max.value ? c : max),
      activeComps[0],
    );
    if (weakest) {
      highlights.push({
        label: 'Weakest Component',
        value: `${weakest.name} (${Math.round(weakest.value)})`,
        sentiment: weakest.value < 50 ? 'negative' : 'neutral',
      });
    }
    if (strongest && strongest !== weakest) {
      highlights.push({
        label: 'Strongest Component',
        value: `${strongest.name} (${Math.round(strongest.value)})`,
        sentiment: strongest.value >= 70 ? 'positive' : 'neutral',
      });
    }

    // EDI (Effective Decentralization)
    if (currentGhi.edi_score != null) {
      highlights.push({
        label: 'Decentralization (EDI)',
        value: `${Math.round(currentGhi.edi_score)}/100`,
        sentiment: currentGhi.edi_score >= 60 ? 'positive' : 'neutral',
      });
    }
  }

  // Inter-body alignment
  if (alignments.length >= 5) {
    const avgAlignment = Math.round(
      alignments.reduce((sum, a) => sum + (a.alignment_score ?? 0), 0) / alignments.length,
    );
    highlights.push({
      label: 'Cross-Body Alignment',
      value: `${avgAlignment}% agreement`,
      sentiment: avgAlignment >= 80 ? 'positive' : avgAlignment >= 60 ? 'neutral' : 'negative',
    });
  }

  // DRep ecosystem health
  if (dreps.length > 0) {
    const avgPart = Math.round(
      dreps.reduce((sum, d) => sum + (d.effective_participation ?? 0), 0) / dreps.length,
    );
    highlights.push({
      label: 'Avg DRep Participation',
      value: `${avgPart}%`,
      sentiment: avgPart >= 50 ? 'positive' : avgPart >= 30 ? 'neutral' : 'negative',
    });
  }

  // Build briefing
  const briefingParts: string[] = [];
  if (currentGhi) {
    const score = Math.round(currentGhi.score);
    briefingParts.push(`Governance health is at ${score}/100.`);
    if (previousGhi) {
      const delta = Math.round(currentGhi.score - previousGhi.score);
      if (delta > 2) briefingParts.push(`Trending up — improving governance engagement.`);
      else if (delta < -2) briefingParts.push(`Trending down — participation may be slipping.`);
      else briefingParts.push(`Stable since last measurement.`);
    }
    const components = (currentGhi.components ?? []) as Array<{
      name: string;
      value: number;
      weight: number;
    }>;
    const activeComps = components.filter((c) => c.weight > 0);
    const weak = activeComps.filter((c) => c.value < 50);
    if (weak.length > 0) {
      briefingParts.push(`Areas needing attention: ${weak.map((c) => c.name).join(', ')}.`);
    }
  }
  if (alignments.length >= 5) {
    const low = alignments.filter((a) => (a.alignment_score ?? 0) < 60);
    if (low.length > alignments.length * 0.3) {
      briefingParts.push(
        `Cross-body tensions detected — DReps, SPOs, and CC disagree on ${low.length} recent proposals.`,
      );
    }
  }

  if (stakeAddress) {
    suggestedActions.push({
      label: 'See how your DRep contributes to health',
      href: '/governance/health',
      priority: 'medium',
    });
  }
  suggestedActions.push({
    label: 'Explore GHI components',
    href: '/governance/health',
    priority: 'low',
  });

  // Treasury health contribution
  const treasury = await fetchGovernanceTreasuryContext().catch(() => null);
  if (treasury?.treasuryData) {
    const healthy = treasury.runwayMonths > 24;
    const runwayYears = treasury.runwayMonths / 12;
    const runwayLabel = runwayYears > 20 ? '10+ yr' : `${Math.round(treasury.runwayMonths)}mo`;
    highlights.push({
      label: 'Treasury Health',
      value: `${healthy ? 'Healthy' : 'Attention'} · ${runwayLabel} runway`,
      sentiment: healthy ? 'positive' : 'negative',
    });
  }

  return {
    briefing: briefingParts.join(' '),
    highlights,
    suggestedActions,
    routeType: 'health',
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Workspace — pending reviews, draft status, activity signals
// ---------------------------------------------------------------------------

async function synthesizeWorkspaceContext(stakeAddress?: string): Promise<ContextSynthesisResult> {
  const supabase = createClient();

  const highlights: ContextHighlight[] = [];
  const suggestedActions: SuggestedAction[] = [];

  if (!stakeAddress) {
    return {
      briefing:
        'Connect your wallet to see workspace intelligence — pending reviews, draft status, and collaboration signals.',
      highlights: [],
      suggestedActions: [{ label: 'Connect wallet', href: '/hub', priority: 'high' }],
      routeType: 'workspace',
      computedAt: new Date().toISOString(),
    };
  }

  // Parallel: user's drafts, pending reviews, recent activity
  const [draftsResult, reviewsResult, activeProposals] = await Promise.all([
    supabase
      .from('proposal_drafts')
      .select('id, title, status, updated_at')
      .eq('author_stake_address', stakeAddress)
      .order('updated_at', { ascending: false })
      .limit(10),
    supabase
      .from('proposal_reviews')
      .select('id, status, proposal_draft_id, updated_at')
      .eq('reviewer_stake_address', stakeAddress)
      .eq('status', 'pending')
      .limit(10),
    supabase
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null),
  ]);

  const drafts = draftsResult.data ?? [];
  const pendingReviews = reviewsResult.data ?? [];
  const activeCount = activeProposals.count ?? 0;

  // Draft status
  const activeDrafts = drafts.filter((d) => d.status !== 'submitted' && d.status !== 'archived');
  if (activeDrafts.length > 0) {
    highlights.push({
      label: 'Active Drafts',
      value: String(activeDrafts.length),
      sentiment: 'neutral',
    });
    const stale = activeDrafts.filter((d) => {
      const updated = new Date(d.updated_at).getTime();
      const daysAgo = (Date.now() - updated) / (1000 * 60 * 60 * 24);
      return daysAgo > 7;
    });
    if (stale.length > 0) {
      highlights.push({
        label: 'Stale Drafts',
        value: `${stale.length} not updated in 7+ days`,
        sentiment: 'negative',
      });
    }
  }

  // Pending reviews
  if (pendingReviews.length > 0) {
    highlights.push({
      label: 'Pending Reviews',
      value: String(pendingReviews.length),
      sentiment: pendingReviews.length > 3 ? 'negative' : 'neutral',
    });
  }

  // Active proposals context
  highlights.push({
    label: 'Network Proposals',
    value: `${activeCount} active`,
    sentiment: 'neutral',
  });

  // Build briefing
  const briefingParts: string[] = [];
  if (pendingReviews.length > 0) {
    briefingParts.push(
      `You have ${pendingReviews.length} pending review${pendingReviews.length !== 1 ? 's' : ''} waiting for your input.`,
    );
  }
  if (activeDrafts.length > 0) {
    briefingParts.push(
      `${activeDrafts.length} draft${activeDrafts.length !== 1 ? 's' : ''} in progress.`,
    );
    const stale = activeDrafts.filter((d) => {
      const updated = new Date(d.updated_at).getTime();
      return (Date.now() - updated) / (1000 * 60 * 60 * 24) > 7;
    });
    if (stale.length > 0) {
      briefingParts.push(
        `${stale.length} haven't been touched in over a week — consider finishing or archiving.`,
      );
    }
  }
  if (briefingParts.length === 0) {
    briefingParts.push(
      `Your workspace is clear. ${activeCount} proposals are active on the network — consider reviewing or drafting a new one.`,
    );
  }

  // Suggested actions
  if (pendingReviews.length > 0) {
    suggestedActions.push({
      label: `Complete ${pendingReviews.length} pending review${pendingReviews.length !== 1 ? 's' : ''}`,
      href: '/workspace/review',
      priority: 'high',
    });
  }
  if (activeDrafts.length === 0) {
    suggestedActions.push({
      label: 'Start a new proposal draft',
      href: '/workspace/author',
      priority: 'medium',
    });
  }

  // Treasury awareness for workspace
  const pendingTreasuryResult = await supabase
    .from('proposals')
    .select('*', { count: 'exact', head: true })
    .is('ratified_epoch', null)
    .is('enacted_epoch', null)
    .is('dropped_epoch', null)
    .is('expired_epoch', null)
    .not('withdrawal_amount', 'is', null);
  const pendingTreasuryCount = pendingTreasuryResult.count ?? 0;
  if (pendingTreasuryCount > 0) {
    highlights.push({
      label: 'Pending Treasury',
      value: `${pendingTreasuryCount} proposal${pendingTreasuryCount !== 1 ? 's' : ''}`,
      sentiment: pendingTreasuryCount > 5 ? 'negative' : 'neutral',
    });
    suggestedActions.push({
      label: `Review ${pendingTreasuryCount} pending treasury proposal${pendingTreasuryCount !== 1 ? 's' : ''}`,
      href: '/governance/treasury',
      priority: 'medium',
    });
  }

  return {
    briefing: briefingParts.join(' '),
    highlights,
    suggestedActions,
    routeType: 'workspace',
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Treasury — dedicated treasury page intelligence
// ---------------------------------------------------------------------------

async function synthesizeTreasuryContext(_stakeAddress?: string): Promise<ContextSynthesisResult> {
  const highlights: ContextHighlight[] = [];
  const suggestedActions: SuggestedAction[] = [];

  const treasury = await fetchGovernanceTreasuryContext().catch(() => null);

  if (!treasury?.treasuryData) {
    return emptyResult('treasury');
  }

  const runwayYears = treasury.runwayMonths / 12;
  const runwayLabel = runwayYears > 20 ? '10+ years' : `${Math.round(treasury.runwayMonths)}mo`;
  const healthy = treasury.runwayMonths > 24;

  highlights.push({
    label: 'Runway',
    value: runwayLabel,
    sentiment: healthy ? 'positive' : treasury.runwayMonths > 12 ? 'neutral' : 'negative',
  });

  if (treasury.ncl) {
    highlights.push({
      label: 'NCL Used',
      value: `${Math.round(treasury.ncl.utilizationPct)}%`,
      sentiment:
        treasury.ncl.utilizationPct > 75
          ? 'negative'
          : treasury.ncl.utilizationPct > 50
            ? 'neutral'
            : 'positive',
    });
  }

  // Pending treasury proposals
  const supabase = createClient();
  const pendingResult = await supabase
    .from('proposals')
    .select('tx_hash, withdrawal_amount', { count: 'exact' })
    .is('ratified_epoch', null)
    .is('enacted_epoch', null)
    .is('dropped_epoch', null)
    .is('expired_epoch', null)
    .not('withdrawal_amount', 'is', null);
  const pendingCount = pendingResult.count ?? 0;
  const pendingTotalAda = (pendingResult.data ?? []).reduce(
    (sum, p) => sum + Math.round(Number(p.withdrawal_amount ?? 0) / 1_000_000),
    0,
  );

  if (pendingCount > 0) {
    highlights.push({
      label: 'Pending',
      value: `${pendingCount} (${formatAda(pendingTotalAda)} ADA)`,
      sentiment: pendingTotalAda > 50_000_000 ? 'negative' : 'neutral',
    });
    suggestedActions.push({
      label: `Review ${pendingCount} pending treasury proposal${pendingCount !== 1 ? 's' : ''}`,
      href: '/governance/proposals',
      priority: 'high',
    });
  }

  const briefingParts: string[] = [];
  briefingParts.push(
    `Treasury balance: ${formatAda(treasury.treasuryData.balanceAda)} ADA with ${runwayLabel} runway.`,
  );
  if (treasury.ncl) {
    briefingParts.push(`NCL budget is ${Math.round(treasury.ncl.utilizationPct)}% utilized.`);
  }
  if (pendingCount > 0) {
    briefingParts.push(
      `${pendingCount} treasury withdrawal${pendingCount !== 1 ? 's' : ''} totaling ${formatAda(pendingTotalAda)} ADA are pending.`,
    );
  }

  suggestedActions.push({
    label: 'Explore treasury details',
    href: '/governance/treasury',
    priority: 'low',
  });

  return {
    briefing: briefingParts.join(' '),
    highlights,
    suggestedActions,
    routeType: 'treasury',
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Produce contextual intelligence for a given page path and user.
 * Results are cached per user+route for 5 minutes via Redis.
 */
export async function synthesizeContext(
  input: ContextSynthesisInput,
): Promise<ContextSynthesisResult> {
  const { pathname, stakeAddress, entityId } = input;
  const route = parseRoute(pathname);

  // Override entityId from route if detected
  const resolvedEntityId = entityId || route.entityId;

  // Cache key: route type + entity + user
  const cacheKey = `ctx:${route.type}:${resolvedEntityId ?? 'none'}:${stakeAddress ?? 'anon'}`;

  try {
    return await cached(cacheKey, 300, async () => {
      switch (route.type) {
        case 'proposal':
          return resolvedEntityId
            ? synthesizeProposalContext(resolvedEntityId, stakeAddress)
            : emptyResult('proposal');
        case 'drep':
          return resolvedEntityId
            ? synthesizeDrepContext(resolvedEntityId, stakeAddress)
            : emptyResult('drep');
        case 'hub':
          return synthesizeHubContext(stakeAddress);
        case 'proposals-list':
          return synthesizeProposalsListContext(stakeAddress);
        case 'representatives-list':
          return synthesizeRepresentativesListContext(stakeAddress);
        case 'health':
          return synthesizeHealthContext(stakeAddress);
        case 'treasury':
          return synthesizeTreasuryContext(stakeAddress);
        case 'workspace':
          return synthesizeWorkspaceContext(stakeAddress);
        case 'governance':
        case 'list':
          return synthesizeHubContext(stakeAddress);
        default:
          return emptyResult('unknown');
      }
    });
  } catch (err) {
    logger.warn('[intelligence/context] Synthesis failed, returning data-only context', {
      error: err,
    });
    // Fallback: try without cache
    try {
      switch (route.type) {
        case 'proposal':
          return resolvedEntityId
            ? await synthesizeProposalContext(resolvedEntityId, stakeAddress)
            : emptyResult('proposal');
        case 'drep':
          return resolvedEntityId
            ? await synthesizeDrepContext(resolvedEntityId, stakeAddress)
            : emptyResult('drep');
        case 'proposals-list':
          return await synthesizeProposalsListContext(stakeAddress);
        case 'representatives-list':
          return await synthesizeRepresentativesListContext(stakeAddress);
        case 'health':
          return await synthesizeHealthContext(stakeAddress);
        case 'treasury':
          return await synthesizeTreasuryContext(stakeAddress);
        case 'workspace':
          return await synthesizeWorkspaceContext(stakeAddress);
        case 'hub':
        case 'governance':
        case 'list':
          return await synthesizeHubContext(stakeAddress);
        default:
          return emptyResult('unknown');
      }
    } catch {
      return emptyResult(route.type);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyResult(routeType: RouteType): ContextSynthesisResult {
  return {
    briefing: '',
    highlights: [],
    suggestedActions: [],
    routeType,
    computedAt: new Date().toISOString(),
  };
}

function cosineDistance(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
