/**
 * GHI v2 Component Computations
 *
 * 8 components across 3 categories:
 *   Engagement (35%): DRep Participation (15%), SPO Participation (10%), Citizen Engagement (10%)
 *   Quality (40%):    Deliberation Quality (15%), Governance Effectiveness (15%), CC Constitutional Fidelity (10%)
 *   Resilience (25%): Power Distribution (15%), System Stability (10%)
 *
 * Each function returns a raw 0-100 score. Calibration is applied externally.
 */

import { createClient } from '@/lib/supabase';
import { calculateTreasuryHealthScore } from '@/lib/treasury';
import { computeEDI, type EDIResult } from './ediMetrics';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ComponentInput {
  supabase: ReturnType<typeof createClient>;
  currentEpoch: number;
}

export interface ComponentScore {
  raw: number;
  detail?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// 2A. DRep Participation (20%)
// ---------------------------------------------------------------------------

export async function computeDRepParticipation({
  supabase,
}: ComponentInput): Promise<ComponentScore> {
  const { data: dreps } = await supabase
    .from('dreps')
    .select('effective_participation, info')
    .not('info->isActive', 'is', null);

  const active = (dreps ?? []).filter((d) => (d.info as Record<string, unknown> | null)?.isActive);
  if (active.length === 0) return { raw: 0 };

  // Participation-weighted median: weight each DRep's participation by their
  // voting power so that DReps with more delegation carry proportionally more
  // influence on the system-level health signal. This reflects whether the ADA
  // that IS delegated is being well-represented, rather than penalizing the
  // index for ghost DReps who registered but never participate.
  const entries = active
    .map((d) => ({
      participation: (d.effective_participation as number) ?? 0,
      weight: parseInt(
        String((d.info as Record<string, unknown> | null)?.votingPowerLovelace || '0'),
        10,
      ),
    }))
    .filter((e) => e.weight > 0)
    .sort((a, b) => a.participation - b.participation);

  if (entries.length === 0) return { raw: 0 };

  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
  const halfWeight = totalWeight / 2;

  let cumulativeWeight = 0;
  let weightedMedian = entries[0].participation;
  for (const entry of entries) {
    cumulativeWeight += entry.weight;
    if (cumulativeWeight >= halfWeight) {
      weightedMedian = entry.participation;
      break;
    }
  }

  // Also compute unweighted median for detail reporting
  const participationValues = active
    .map((d) => (d.effective_participation as number) ?? 0)
    .sort((a, b) => a - b);
  const mid = Math.floor(participationValues.length / 2);
  const unweightedMedian =
    participationValues.length % 2 === 0
      ? (participationValues[mid - 1] + participationValues[mid]) / 2
      : participationValues[mid];

  return {
    raw: Math.min(100, Math.max(0, weightedMedian)),
    detail: {
      weightedMedianParticipation: weightedMedian,
      unweightedMedianParticipation: unweightedMedian,
      activeDreps: active.length,
    },
  };
}

// ---------------------------------------------------------------------------
// 2B. Citizen Engagement (15%) — feature flagged
// ---------------------------------------------------------------------------

export interface CitizenEngagementInput extends ComponentInput {
  circulatingSupply?: number;
}

export async function computeCitizenEngagement({
  supabase,
  currentEpoch,
  circulatingSupply,
}: CitizenEngagementInput): Promise<ComponentScore> {
  // --- Sub-signal 1: Delegation rate (50%) ---
  let delegationRateScore = 50; // neutral fallback
  if (circulatingSupply && circulatingSupply > 0) {
    const { data: dreps } = await supabase
      .from('dreps')
      .select('info')
      .not('info->isActive', 'is', null);
    const activeDreps = (dreps ?? []).filter(
      (d) => (d.info as Record<string, unknown> | null)?.isActive,
    );
    const totalDelegatedLovelace = activeDreps.reduce(
      (sum, d) =>
        sum +
        parseInt(
          String((d.info as Record<string, unknown> | null)?.votingPowerLovelace || '0'),
          10,
        ),
      0,
    );
    const delegationRate = totalDelegatedLovelace / circulatingSupply;
    // Target 40-70%: clamp to 0-100
    delegationRateScore = Math.min(100, Math.max(0, delegationRate * 100));
  }

  // --- Sub-signal 2: Delegation dynamism (30%) ---
  let dynamismScore = 50; // neutral fallback
  const prevEpoch = currentEpoch - 1;
  const { data: currentSnaps } = await supabase
    .from('drep_power_snapshots')
    .select('drep_id, delegator_count')
    .eq('epoch_no', currentEpoch);
  const { data: prevSnaps } = await supabase
    .from('drep_power_snapshots')
    .select('drep_id, delegator_count')
    .eq('epoch_no', prevEpoch);

  if (currentSnaps?.length && prevSnaps?.length) {
    const prevMap = new Map(prevSnaps.map((s) => [s.drep_id, s.delegator_count ?? 0]));
    let changed = 0;
    for (const snap of currentSnaps) {
      const prev = prevMap.get(snap.drep_id);
      if (prev !== undefined && prev !== (snap.delegator_count ?? 0)) changed++;
    }
    const churnRate = (changed / currentSnaps.length) * 100;
    // Sweet spot: 5-20% churn. Clamp to bell curve.
    if (churnRate < 5) dynamismScore = (churnRate / 5) * 50;
    else if (churnRate <= 20) dynamismScore = 50 + ((churnRate - 5) / 15) * 50;
    else dynamismScore = Math.max(30, 100 - (churnRate - 20) * 2);
  }

  // Platform engagement sub-signal deprecated (was 20%).
  // Redistributed: delegation rate 62.5%, dynamism 37.5%.
  const raw = delegationRateScore * 0.625 + dynamismScore * 0.375;

  return {
    raw: Math.min(100, Math.max(0, Math.round(raw))),
    detail: {
      delegationRate: Math.round(delegationRateScore),
      dynamism: Math.round(dynamismScore),
      platformEngagement: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// 2C. Deliberation Quality (20%)
// ---------------------------------------------------------------------------

export async function computeDeliberationQuality({
  supabase,
  currentEpoch,
}: ComponentInput): Promise<ComponentScore> {
  const recentEpochMin = currentEpoch - 2;

  // --- Sub-signal 1: Rationale quality (50%) ---
  const { data: votesWithQuality } = await supabase
    .from('drep_votes')
    .select('rationale_quality')
    .gte('epoch_no', recentEpochMin)
    .not('rationale_quality', 'is', null);

  let rationaleScore = 50;
  if (votesWithQuality?.length) {
    const avg =
      votesWithQuality.reduce((s, v) => s + ((v.rationale_quality as number) ?? 0), 0) /
      votesWithQuality.length;
    rationaleScore = Math.min(100, avg);
  } else {
    // Fallback: binary rationale rate
    const { data: allVotes } = await supabase
      .from('drep_votes')
      .select('meta_url')
      .gte('epoch_no', recentEpochMin);
    if (allVotes?.length) {
      const withRationale = allVotes.filter((v) => v.meta_url).length;
      rationaleScore = Math.round((withRationale / allVotes.length) * 100);
    }
  }

  // --- Sub-signal 2: Debate diversity (30%) ---
  const proposalEpochMin = currentEpoch - 3;
  const { data: recentVotes } = await supabase
    .from('drep_votes')
    .select('drep_id, proposal_tx_hash, proposal_index, vote')
    .gte('epoch_no', proposalEpochMin);

  let debateDiversityScore = 50;
  if (recentVotes?.length) {
    const proposalVotes = new Map<string, { yes: number; total: number }>();
    for (const v of recentVotes) {
      const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
      const entry = proposalVotes.get(key) ?? { yes: 0, total: 0 };
      entry.total++;
      if (v.vote === 'Yes') entry.yes++;
      proposalVotes.set(key, entry);
    }

    let totalDiscrimination = 0;
    let proposalCount = 0;
    for (const { yes, total } of proposalVotes.values()) {
      if (total < 3) continue; // skip proposals with very few votes
      const yesPct = yes / total;
      totalDiscrimination += 1 - Math.abs(yesPct - 0.5) * 2;
      proposalCount++;
    }
    debateDiversityScore =
      proposalCount > 0 ? Math.round((totalDiscrimination / proposalCount) * 100) : 50;
  }

  // --- Sub-signal 3: Voting independence (20%) ---
  // Simplified: % of proposals where top 10 DReps by voting power all voted the same way
  const { data: topDreps } = await supabase
    .from('dreps')
    .select('id, info')
    .not('info->isActive', 'is', null)
    .order('info->votingPowerLovelace', { ascending: false })
    .limit(10);

  let independenceScore = 50;
  if (topDreps?.length && recentVotes?.length) {
    const topIds = new Set(topDreps.map((d) => d.id));
    const proposalTopVotes = new Map<string, string[]>();
    for (const v of recentVotes) {
      if (!topIds.has(v.drep_id)) continue;
      const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
      const votes = proposalTopVotes.get(key) ?? [];
      votes.push(v.vote);
      proposalTopVotes.set(key, votes);
    }

    let unanimousCount = 0;
    let evaluatedCount = 0;
    for (const votes of proposalTopVotes.values()) {
      if (votes.length < 3) continue;
      evaluatedCount++;
      if (new Set(votes).size === 1) unanimousCount++;
    }

    if (evaluatedCount > 0) {
      const unanimousRate = unanimousCount / evaluatedCount;
      independenceScore = Math.round((1 - unanimousRate) * 100);
    }
  }

  const raw = rationaleScore * 0.5 + debateDiversityScore * 0.3 + independenceScore * 0.2;

  return {
    raw: Math.min(100, Math.max(0, Math.round(raw))),
    detail: {
      rationaleQuality: Math.round(rationaleScore),
      debateDiversity: Math.round(debateDiversityScore),
      votingIndependence: Math.round(independenceScore),
    },
  };
}

// ---------------------------------------------------------------------------
// 2D. Governance Effectiveness (20%)
// ---------------------------------------------------------------------------

export async function computeGovernanceEffectiveness({
  supabase,
}: ComponentInput): Promise<ComponentScore> {
  const { data: proposals } = await supabase
    .from('proposals')
    .select(
      'proposed_epoch, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch, tx_hash, proposal_index',
    );

  const { data: votes } = await supabase
    .from('drep_votes')
    .select('proposal_tx_hash, proposal_index', { count: 'exact', head: false });

  const allProposals = proposals ?? [];
  const allVotes = votes ?? [];

  // --- Sub-signal 1: Resolution rate (40%) ---
  const resolved = allProposals.filter(
    (p) => p.ratified_epoch || p.enacted_epoch || p.dropped_epoch || p.expired_epoch,
  );
  const enacted = resolved.filter((p) => p.enacted_epoch || p.ratified_epoch);
  const resolutionRate =
    resolved.length > 0 ? Math.round((enacted.length / resolved.length) * 100) : 50;

  // --- Sub-signal 2: Decision velocity (30%) ---
  const resolvedWithTiming = resolved
    .map((p) => {
      const resEpoch = p.enacted_epoch ?? p.ratified_epoch ?? p.dropped_epoch ?? p.expired_epoch;
      return resEpoch && p.proposed_epoch ? resEpoch - p.proposed_epoch : null;
    })
    .filter((v): v is number => v !== null && v >= 0)
    .sort((a, b) => a - b);

  let velocityScore = 50;
  if (resolvedWithTiming.length > 0) {
    const medianIdx = Math.floor(resolvedWithTiming.length / 2);
    const medianEpochs =
      resolvedWithTiming.length % 2 === 0
        ? (resolvedWithTiming[medianIdx - 1] + resolvedWithTiming[medianIdx]) / 2
        : resolvedWithTiming[medianIdx];

    // Target: 2-6 epochs. <1 = rushed, >10 = gridlock
    if (medianEpochs < 1) velocityScore = 40;
    else if (medianEpochs <= 2) velocityScore = 60;
    else if (medianEpochs <= 6) velocityScore = 80 + ((6 - medianEpochs) / 4) * 20;
    else if (medianEpochs <= 10) velocityScore = 80 - ((medianEpochs - 6) / 4) * 40;
    else velocityScore = Math.max(10, 40 - (medianEpochs - 10) * 5);
  }

  // --- Sub-signal 3: Throughput rate (30%) ---
  const votedKeys = new Set(allVotes.map((v) => `${v.proposal_tx_hash}-${v.proposal_index}`));
  const throughput =
    allProposals.length > 0
      ? Math.min(100, Math.round((votedKeys.size / allProposals.length) * 100))
      : 50;

  const raw = resolutionRate * 0.4 + velocityScore * 0.3 + throughput * 0.3;

  return {
    raw: Math.min(100, Math.max(0, Math.round(raw))),
    detail: {
      resolutionRate,
      decisionVelocity: Math.round(velocityScore),
      throughput,
    },
  };
}

// ---------------------------------------------------------------------------
// 2E. Power Distribution (15%) — EDI-powered
// ---------------------------------------------------------------------------

export async function computePowerDistribution({
  supabase,
  currentEpoch,
}: ComponentInput): Promise<ComponentScore & { edi: EDIResult }> {
  const { data: dreps } = await supabase
    .from('dreps')
    .select('id, info')
    .not('info->isActive', 'is', null);

  const activeDreps = (dreps ?? []).filter(
    (d) => (d.info as Record<string, unknown> | null)?.isActive,
  );
  const votingPowers = activeDreps
    .map((d) =>
      parseInt(String((d.info as Record<string, unknown> | null)?.votingPowerLovelace || '0'), 10),
    )
    .filter((v) => v > 0);

  const edi = computeEDI(votingPowers);

  // Bonus: new DRep onboarding rate (up to +10 points)
  const epochMin = currentEpoch - 3;
  const { data: recentFirstVotes } = await supabase
    .from('drep_votes')
    .select('drep_id')
    .gte('epoch_no', epochMin);

  let onboardingBonus = 0;
  if (recentFirstVotes?.length && activeDreps.length > 0) {
    const uniqueRecentVoters = new Set(recentFirstVotes.map((v) => v.drep_id));
    // Approximate: DReps active in recent 3 epochs who might be new
    // A more precise check would compare earliest vote per DRep, but this is a reasonable proxy
    const newRate = uniqueRecentVoters.size / activeDreps.length;
    onboardingBonus = Math.min(10, Math.round(newRate * 30));
  }

  const raw = Math.min(100, edi.compositeScore + onboardingBonus);

  return {
    raw,
    edi,
    detail: {
      ediComposite: edi.compositeScore,
      onboardingBonus,
      activeDrepCount: activeDreps.length,
    },
  };
}

// ---------------------------------------------------------------------------
// 2F. SPO Participation (10%)
// ---------------------------------------------------------------------------

export async function computeSPOParticipation({
  supabase,
}: ComponentInput): Promise<ComponentScore> {
  // Get SPO governance votes and total eligible proposals
  const { data: spoVotes } = await supabase
    .from('spo_votes')
    .select('pool_id, proposal_tx_hash, proposal_index');

  const { data: proposals } = await supabase.from('proposals').select('tx_hash, proposal_index');

  if (!proposals?.length) return { raw: 0 };

  const totalProposals = new Set(proposals.map((p) => `${p.tx_hash}:${p.proposal_index}`)).size;

  if (!spoVotes?.length) return { raw: 0, detail: { activeSpos: 0, medianParticipation: 0 } };

  // Group by SPO and compute participation rate per pool
  const poolVotes = new Map<string, Set<string>>();
  for (const v of spoVotes) {
    const set = poolVotes.get(v.pool_id) ?? new Set();
    set.add(`${v.proposal_tx_hash}:${v.proposal_index}`);
    poolVotes.set(v.pool_id, set);
  }

  const rates = Array.from(poolVotes.values())
    .map((voted) => (voted.size / totalProposals) * 100)
    .sort((a, b) => a - b);

  const mid = Math.floor(rates.length / 2);
  const medianParticipation =
    rates.length % 2 === 0 ? (rates[mid - 1] + rates[mid]) / 2 : rates[mid];

  return {
    raw: Math.min(100, Math.max(0, Math.round(medianParticipation))),
    detail: {
      activeSpos: poolVotes.size,
      medianParticipation: Math.round(medianParticipation),
      totalProposals,
    },
  };
}

// ---------------------------------------------------------------------------
// 2G. CC Constitutional Fidelity (10%)
// ---------------------------------------------------------------------------

export async function computeCCConstitutionalFidelity({
  supabase,
}: ComponentInput): Promise<ComponentScore> {
  // Read pre-computed fidelity scores from cc_members
  const { data: members } = await supabase
    .from('cc_members')
    .select('cc_hot_id, fidelity_score, status')
    .not('fidelity_score', 'is', null);

  if (!members?.length) return { raw: 0 };

  // Only score active members
  const active = members.filter((m) => m.status === 'active' || m.status === 'Active');
  const scored = active.length > 0 ? active : members;

  const scores = scored
    .map((m) => (m.fidelity_score as number) ?? 0)
    .filter((s) => s > 0)
    .sort((a, b) => a - b);

  if (scores.length === 0) return { raw: 0, detail: { activeCcMembers: scored.length } };

  // Median fidelity score across CC members
  const mid = Math.floor(scores.length / 2);
  const medianFidelity =
    scores.length % 2 === 0 ? (scores[mid - 1] + scores[mid]) / 2 : scores[mid];

  return {
    raw: Math.min(100, Math.max(0, Math.round(medianFidelity))),
    detail: {
      activeCcMembers: scored.length,
      medianFidelity: Math.round(medianFidelity),
      scoredCount: scores.length,
    },
  };
}

// ---------------------------------------------------------------------------
// 2H. Treasury Health (8%)
// ---------------------------------------------------------------------------

export async function computeTreasuryHealth(_input: ComponentInput): Promise<ComponentScore> {
  const health = await calculateTreasuryHealthScore();
  if (!health) return { raw: 0 };

  return {
    raw: health.score,
    detail: {
      balanceTrend: health.components.balanceTrend,
      withdrawalVelocity: health.components.withdrawalVelocity,
      incomeStability: health.components.incomeStability,
      pendingLoad: health.components.pendingLoad,
      runwayAdequacy: health.components.runwayAdequacy,
      nclDiscipline: health.components.nclDiscipline,
    },
  };
}

// ---------------------------------------------------------------------------
// 2I. System Stability (10%)
// ---------------------------------------------------------------------------

export async function computeSystemStability({
  supabase,
}: ComponentInput): Promise<ComponentScore> {
  // --- Sub-signal 1: DRep retention (50%) ---
  const { data: ghiSnaps } = await supabase
    .from('ghi_snapshots')
    .select('epoch_no, components')
    .order('epoch_no', { ascending: false })
    .limit(2);

  let retentionScore = 70; // neutral-healthy default
  if (ghiSnaps?.length === 2) {
    interface GHIComponentSnapshot {
      name: string;
      detail?: Record<string, number>;
      [key: string]: unknown;
    }
    const currentComps = ghiSnaps[0].components as GHIComponentSnapshot[];
    const prevComps = ghiSnaps[1].components as GHIComponentSnapshot[];
    const getCurrent = currentComps?.find((c) => c.name === 'DRep Participation');
    const getPrev = prevComps?.find((c) => c.name === 'DRep Participation');
    if (getCurrent && getPrev && (getPrev.detail?.activeDreps ?? 0) > 0) {
      const ratio = (getCurrent.detail?.activeDreps ?? 0) / (getPrev.detail?.activeDreps ?? 1);
      retentionScore = Math.min(100, Math.round(ratio * 80));
    }
  } else {
    // Fallback: use current active vs total
    const { data: dreps } = await supabase.from('dreps').select('info');
    const all = dreps ?? [];
    const active = all.filter((d) => (d.info as Record<string, unknown> | null)?.isActive);
    retentionScore = all.length > 0 ? Math.round((active.length / all.length) * 100) : 50;
  }

  // --- Sub-signal 2: Score volatility (30%) ---
  let volatilityScore = 70; // neutral
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const { data: recentScores } = await supabase
    .from('drep_score_history')
    .select('drep_id, score, snapshot_date')
    .in('snapshot_date', [weekAgo, today]);

  if (recentScores?.length) {
    const byDrep = new Map<string, { old?: number; current?: number }>();
    for (const row of recentScores) {
      const entry = byDrep.get(row.drep_id) ?? {};
      if (row.snapshot_date === weekAgo) entry.old = row.score;
      if (row.snapshot_date === today) entry.current = row.score;
      byDrep.set(row.drep_id, entry);
    }

    let totalAbsDelta = 0;
    let count = 0;
    for (const { old, current } of byDrep.values()) {
      if (old !== undefined && current !== undefined) {
        totalAbsDelta += Math.abs(current - old);
        count++;
      }
    }

    if (count > 0) {
      const meanAbsDelta = totalAbsDelta / count;
      // 1 - (meanAbsDelta / 20): lower volatility = higher score
      volatilityScore = Math.min(100, Math.max(0, Math.round((1 - meanAbsDelta / 20) * 100)));
    }
  }

  // --- Sub-signal 3: Infrastructure health (20%) ---
  let infraScore = 50;
  const { data: syncHealth } = await supabase.from('v_sync_health').select('*');

  if (syncHealth?.length) {
    const total = syncHealth.length;
    const healthy = syncHealth.filter((s) => s.last_success === true).length;
    infraScore = Math.round((healthy / total) * 100);
  }

  const raw = retentionScore * 0.5 + volatilityScore * 0.3 + infraScore * 0.2;

  return {
    raw: Math.min(100, Math.max(0, Math.round(raw))),
    detail: {
      drepRetention: Math.round(retentionScore),
      scoreVolatility: Math.round(volatilityScore),
      infrastructureHealth: Math.round(infraScore),
    },
  };
}
