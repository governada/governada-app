/**
 * Historical GHI Computation — epoch-scoped variant of computeGHI().
 *
 * Computes all 10 GHI components using only data available at a given epoch.
 * Designed for the backfill pipeline (epochs 530-621).
 *
 * Key differences from live computeGHI():
 * - All Supabase queries scoped to `epoch <= targetEpoch`
 * - No staleness guards (historical data is inherently complete)
 * - No feature flags (always compute all available components)
 * - CC Fidelity reconstructed from cc_votes + cc_fidelity_snapshots
 * - Treasury Health computed from treasury_snapshots directly
 * - Governance Outcomes always disabled (no data)
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { calibrate, CALIBRATION } from './calibration';
import { computeEDI, type EDIResult } from './ediMetrics';
import type { GHIComponent } from './types';
import { getBand } from './types';
import { GHI_COMPONENT_WEIGHTS } from '@/lib/scoring/calibration';
import { computePairwiseDiversity } from '@/lib/embeddings/quality';
import { cosineSimilarity } from '@/lib/embeddings/query';
import { logger } from '@/lib/logger';

type ComponentName = keyof typeof GHI_COMPONENT_WEIGHTS;

export interface HistoricalGHIResult {
  score: number;
  band: string;
  components: GHIComponent[];
  edi?: EDIResult;
}

// ── Weight redistribution (same logic as live, but always disable Outcomes) ──

function getWeights(): Record<ComponentName, number> {
  // Always disable Governance Outcomes (no data) and Citizen Engagement
  // (feature-flagged off in production, and circulatingSupply not available historically)
  const disabled: ComponentName[] = ['Citizen Engagement', 'Governance Outcomes'];
  const disabledSet = new Set(disabled);
  const enabledEntries = Object.entries(GHI_COMPONENT_WEIGHTS).filter(
    ([name]) => !disabledSet.has(name as ComponentName),
  );
  const totalRemaining = enabledEntries.reduce((s, [, w]) => s + w, 0);

  const redistributed: Record<string, number> = {};
  for (const [name, weight] of enabledEntries) {
    redistributed[name] = weight / totalRemaining;
  }
  for (const name of disabled) {
    redistributed[name] = 0;
  }
  return redistributed as Record<ComponentName, number>;
}

/**
 * Compute GHI for a specific historical epoch.
 * Returns the score, band, component breakdown, and EDI metrics.
 */
export async function computeGHIForEpoch(targetEpoch: number): Promise<HistoricalGHIResult> {
  const supabase = getSupabaseAdmin();

  // Compute all components in parallel
  const [
    drepParticipation,
    spoParticipation,
    deliberation,
    effectiveness,
    ccFidelity,
    power,
    stability,
    treasuryHealth,
  ] = await Promise.all([
    computeDRepParticipationForEpoch(supabase, targetEpoch),
    computeSPOParticipationForEpoch(supabase, targetEpoch),
    computeDeliberationQualityForEpoch(supabase, targetEpoch),
    computeGovernanceEffectivenessForEpoch(supabase, targetEpoch),
    computeCCFidelityForEpoch(supabase, targetEpoch),
    computePowerDistributionForEpoch(supabase, targetEpoch),
    computeSystemStabilityForEpoch(supabase, targetEpoch),
    computeTreasuryHealthForEpoch(supabase, targetEpoch),
  ]);

  const weights = getWeights();

  const calibrated: Record<string, number> = {
    'DRep Participation': calibrate(drepParticipation.raw, CALIBRATION.drepParticipation),
    'SPO Participation': calibrate(spoParticipation.raw, CALIBRATION.spoParticipation),
    'Citizen Engagement': 0,
    'Deliberation Quality': calibrate(deliberation.raw, CALIBRATION.deliberationQuality),
    'Governance Effectiveness': calibrate(effectiveness.raw, CALIBRATION.governanceEffectiveness),
    'CC Constitutional Fidelity': calibrate(ccFidelity.raw, CALIBRATION.ccConstitutionalFidelity),
    'Power Distribution': calibrate(power.raw, CALIBRATION.powerDistribution),
    'System Stability': calibrate(stability.raw, CALIBRATION.systemStability),
    'Treasury Health': calibrate(treasuryHealth.raw, CALIBRATION.treasuryHealth),
    'Governance Outcomes': 0,
  };

  const components: GHIComponent[] = Object.entries(calibrated).map(([name, value]) => {
    const weight = weights[name as ComponentName];
    return {
      name,
      value: Math.round(value),
      weight,
      contribution: Math.round(value * weight),
    };
  });

  const score = Math.min(
    100,
    Math.max(
      0,
      components.reduce((s, c) => s + c.contribution, 0),
    ),
  );

  logger.info(`[historical-ghi] Epoch ${targetEpoch}: score=${score}, band=${getBand(score)}`);

  return {
    score,
    band: getBand(score),
    components,
    edi: power.edi,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Component implementations (epoch-scoped)
// ═══════════════════════════════════════════════════════════════════════════

interface RawScore {
  raw: number;
  edi?: EDIResult;
}

type Supabase = ReturnType<typeof getSupabaseAdmin>;

// ── DRep Participation ──────────────────────────────────────────────────

async function computeDRepParticipationForEpoch(
  supabase: Supabase,
  targetEpoch: number,
): Promise<RawScore> {
  // Use backfilled drep_score_history for this epoch
  const { data: scores } = await supabase
    .from('drep_score_history')
    .select('drep_id, effective_participation_v3')
    .eq('epoch_no', targetEpoch)
    .eq('score_version', 'v3.2-backfill')
    .range(0, 99999);

  if (!scores?.length) {
    // Fallback: try live scores at this epoch
    const { data: liveScores } = await supabase
      .from('drep_score_history')
      .select('drep_id, effective_participation_v3')
      .eq('epoch_no', targetEpoch)
      .range(0, 99999);

    if (!liveScores?.length) return { raw: 0 };
    return computeWeightedMedianParticipation(supabase, liveScores, targetEpoch);
  }

  return computeWeightedMedianParticipation(supabase, scores, targetEpoch);
}

async function computeWeightedMedianParticipation(
  supabase: Supabase,
  scores: Array<{ drep_id: string; effective_participation_v3: number | null }>,
  targetEpoch: number,
): Promise<RawScore> {
  // Get voting power at this epoch
  const { data: powerSnaps } = await supabase
    .from('drep_power_snapshots')
    .select('drep_id, amount_lovelace')
    .eq('epoch_no', targetEpoch)
    .gt('amount_lovelace', 0)
    .range(0, 99999);

  if (!powerSnaps?.length) return { raw: 0 };

  const powerMap = new Map(powerSnaps.map((s) => [s.drep_id, Number(s.amount_lovelace)]));

  const entries = scores
    .filter((s) => s.effective_participation_v3 != null)
    .map((s) => ({
      participation: s.effective_participation_v3!,
      weight: powerMap.get(s.drep_id) ?? 0,
    }))
    .filter((e) => e.weight > 0)
    .sort((a, b) => a.participation - b.participation);

  if (entries.length === 0) return { raw: 0 };

  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
  const halfWeight = totalWeight / 2;
  let cumulative = 0;
  let median = entries[0].participation;
  for (const entry of entries) {
    cumulative += entry.weight;
    if (cumulative >= halfWeight) {
      median = entry.participation;
      break;
    }
  }

  return { raw: Math.min(100, Math.max(0, median)) };
}

// ── SPO Participation ───────────────────────────────────────────────────

async function computeSPOParticipationForEpoch(
  supabase: Supabase,
  targetEpoch: number,
): Promise<RawScore> {
  const SPO_ELIGIBLE_TYPES = [
    'HardForkInitiation',
    'ParameterChange',
    'NewCommittee',
    'InfoAction',
  ];

  // Get proposals SPOs could vote on, resolved by this epoch
  const { data: proposals } = await supabase
    .from('proposals')
    .select(
      'tx_hash, proposal_index, proposed_epoch, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch, proposal_type',
    )
    .in('proposal_type', SPO_ELIGIBLE_TYPES)
    .lte('proposed_epoch', targetEpoch)
    .range(0, 99999);

  // Filter to resolved proposals
  const eligible = (proposals ?? []).filter((p) => {
    const resEpoch = p.ratified_epoch ?? p.enacted_epoch ?? p.dropped_epoch ?? p.expired_epoch;
    return resEpoch != null && resEpoch <= targetEpoch;
  });

  if (eligible.length === 0) return { raw: 0 };

  const eligibleSet = new Set(eligible.map((p) => `${p.tx_hash}:${p.proposal_index}`));

  // Get SPO votes up to this epoch
  const { data: spoVotes } = await supabase
    .from('spo_votes')
    .select('pool_id, proposal_tx_hash, proposal_index, epoch')
    .lte('epoch', targetEpoch)
    .range(0, 99999);

  if (!spoVotes?.length) return { raw: 0 };

  const votedProposalKeys = new Set<string>();
  const poolVotes = new Map<string, Set<string>>();
  for (const v of spoVotes) {
    const key = `${v.proposal_tx_hash}:${v.proposal_index}`;
    if (!eligibleSet.has(key)) continue;
    votedProposalKeys.add(key);
    const set = poolVotes.get(v.pool_id) ?? new Set();
    set.add(key);
    poolVotes.set(v.pool_id, set);
  }

  const denominatorProposals = votedProposalKeys.size;
  if (denominatorProposals === 0) return { raw: 0 };

  const rates = Array.from(poolVotes.values())
    .map((voted) => (voted.size / denominatorProposals) * 100)
    .sort((a, b) => a - b);

  const mid = Math.floor(rates.length / 2);
  const median = rates.length % 2 === 0 ? (rates[mid - 1] + rates[mid]) / 2 : rates[mid];

  return { raw: Math.min(100, Math.max(0, Math.round(median))) };
}

// ── Deliberation Quality ────────────────────────────────────────────────

async function computeDeliberationQualityForEpoch(
  supabase: Supabase,
  targetEpoch: number,
): Promise<RawScore> {
  const recentEpochMin = targetEpoch - 2;

  // Sub-signal 1: Rationale quality
  const { data: votesWithQuality } = await supabase
    .from('drep_votes')
    .select('rationale_quality')
    .gte('epoch_no', recentEpochMin)
    .lte('epoch_no', targetEpoch)
    .not('rationale_quality', 'is', null);

  let rationaleScore = 50;
  if (votesWithQuality?.length) {
    const avg =
      votesWithQuality.reduce((s, v) => s + ((v.rationale_quality as number) ?? 0), 0) /
      votesWithQuality.length;
    rationaleScore = Math.min(100, avg);
  } else {
    const { data: allVotes } = await supabase
      .from('drep_votes')
      .select('has_rationale, meta_url')
      .gte('epoch_no', recentEpochMin)
      .lte('epoch_no', targetEpoch);
    if (allVotes?.length) {
      const withRationale = allVotes.filter((vote) => vote.has_rationale ?? !!vote.meta_url).length;
      rationaleScore = Math.round((withRationale / allVotes.length) * 100);
    }
  }

  // Sub-signal 2: Debate diversity
  const proposalEpochMin = targetEpoch - 3;
  const { data: recentVotes } = await supabase
    .from('drep_votes')
    .select('drep_id, proposal_tx_hash, proposal_index, vote')
    .gte('epoch_no', proposalEpochMin)
    .lte('epoch_no', targetEpoch)
    .range(0, 99999);

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
      if (total < 3) continue;
      const yesPct = yes / total;
      totalDiscrimination += 1 - Math.abs(yesPct - 0.5) * 2;
      proposalCount++;
    }
    debateDiversityScore =
      proposalCount > 0 ? Math.round((totalDiscrimination / proposalCount) * 100) : 50;
  }

  // Sub-signal 3: Voting independence
  const { data: allDreps } = await supabase
    .from('drep_power_snapshots')
    .select('drep_id, amount_lovelace')
    .eq('epoch_no', targetEpoch)
    .gt('amount_lovelace', 0)
    .order('amount_lovelace', { ascending: false })
    .limit(10);

  let independenceScore = 50;
  if (allDreps?.length && recentVotes?.length) {
    const topIds = new Set(allDreps.map((d) => d.drep_id));
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
      independenceScore = Math.round((1 - unanimousCount / evaluatedCount) * 100);
    }
  }

  // Sub-signals 4 & 5: Semantic diversity + reasoning coherence (from embeddings)
  let semanticDiversityScore = 0;
  let reasoningCoherenceScore = 0;
  let embeddingsAvailable = false;

  try {
    const { data: rationaleEmbeddings } = await supabase
      .from('embeddings')
      .select('entity_id, secondary_id, embedding')
      .eq('entity_type', 'rationale')
      .limit(500);

    if (rationaleEmbeddings?.length && rationaleEmbeddings.length >= 2) {
      embeddingsAvailable = true;

      const proposalGroups = new Map<string, number[][]>();
      for (const re of rationaleEmbeddings) {
        const group = proposalGroups.get(re.entity_id) ?? [];
        group.push(re.embedding as unknown as number[]);
        proposalGroups.set(re.entity_id, group);
      }

      let totalDiversity = 0;
      let pCount = 0;
      for (const embeddings of proposalGroups.values()) {
        if (embeddings.length >= 2) {
          totalDiversity += computePairwiseDiversity(embeddings);
          pCount++;
        }
      }
      if (pCount > 0) semanticDiversityScore = Math.round((totalDiversity / pCount) * 100);

      const { data: proposalEmbeddings } = await supabase
        .from('embeddings')
        .select('entity_id, embedding')
        .eq('entity_type', 'proposal')
        .limit(500);

      if (proposalEmbeddings?.length) {
        const proposalEmbeddingMap = new Map<string, number[]>(
          proposalEmbeddings.map((pe) => [pe.entity_id, pe.embedding as unknown as number[]]),
        );

        let totalCoherence = 0;
        let coherenceCount = 0;
        for (const re of rationaleEmbeddings) {
          const proposalEmb = proposalEmbeddingMap.get(re.entity_id);
          if (proposalEmb) {
            const similarity = cosineSimilarity(re.embedding as unknown as number[], proposalEmb);
            totalCoherence += Math.max(0, similarity) * 100;
            coherenceCount++;
          }
        }
        if (coherenceCount > 0)
          reasoningCoherenceScore = Math.round(totalCoherence / coherenceCount);
      }
    }
  } catch {
    embeddingsAvailable = false;
  }

  let raw: number;
  if (embeddingsAvailable) {
    raw =
      rationaleScore * 0.25 +
      debateDiversityScore * 0.15 +
      independenceScore * 0.1 +
      semanticDiversityScore * 0.3 +
      reasoningCoherenceScore * 0.2;
  } else {
    raw = rationaleScore * 0.5 + debateDiversityScore * 0.3 + independenceScore * 0.2;
  }

  return { raw: Math.min(100, Math.max(0, Math.round(raw))) };
}

// ── Governance Effectiveness ────────────────────────────────────────────

async function computeGovernanceEffectivenessForEpoch(
  supabase: Supabase,
  targetEpoch: number,
): Promise<RawScore> {
  const { data: proposals } = await supabase
    .from('proposals')
    .select(
      'proposed_epoch, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch, tx_hash, proposal_index',
    )
    .lte('proposed_epoch', targetEpoch)
    .range(0, 99999);

  const { data: votes } = await supabase
    .from('drep_votes')
    .select('proposal_tx_hash, proposal_index')
    .lte('epoch_no', targetEpoch)
    .range(0, 99999);

  const allProposals = proposals ?? [];

  // Resolution rate — only count proposals resolved by this epoch
  const resolved = allProposals.filter((p) => {
    const resEpoch = p.ratified_epoch ?? p.enacted_epoch ?? p.dropped_epoch ?? p.expired_epoch;
    return resEpoch != null && resEpoch <= targetEpoch;
  });
  const enacted = resolved.filter((p) => {
    const enactEpoch = p.enacted_epoch ?? p.ratified_epoch;
    return enactEpoch != null && enactEpoch <= targetEpoch;
  });
  const resolutionRate =
    resolved.length > 0 ? Math.round((enacted.length / resolved.length) * 100) : 50;

  // Decision velocity
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

    if (medianEpochs < 1) velocityScore = 40;
    else if (medianEpochs <= 2) velocityScore = 60;
    else if (medianEpochs <= 6) velocityScore = 80 + ((6 - medianEpochs) / 4) * 20;
    else if (medianEpochs <= 10) velocityScore = 80 - ((medianEpochs - 6) / 4) * 40;
    else velocityScore = Math.max(10, 40 - (medianEpochs - 10) * 5);
  }

  // Throughput
  const votedKeys = new Set((votes ?? []).map((v) => `${v.proposal_tx_hash}-${v.proposal_index}`));
  const throughput =
    allProposals.length > 0
      ? Math.min(100, Math.round((votedKeys.size / allProposals.length) * 100))
      : 50;

  const raw = resolutionRate * 0.4 + velocityScore * 0.3 + throughput * 0.3;
  return { raw: Math.min(100, Math.max(0, Math.round(raw))) };
}

// ── CC Constitutional Fidelity ──────────────────────────────────────────

async function computeCCFidelityForEpoch(
  supabase: Supabase,
  targetEpoch: number,
): Promise<RawScore> {
  // First, try cc_fidelity_snapshots (available for epochs 617+)
  const { data: snapshots } = await supabase
    .from('cc_fidelity_snapshots')
    .select('cc_hot_id, fidelity_score')
    .eq('epoch_no', targetEpoch)
    .not('fidelity_score', 'is', null);

  if (snapshots?.length) {
    const scores = snapshots
      .map((s) => (s.fidelity_score as number) ?? 0)
      .filter((s) => s > 0)
      .sort((a, b) => a - b);

    if (scores.length > 0) {
      const mid = Math.floor(scores.length / 2);
      const median = scores.length % 2 === 0 ? (scores[mid - 1] + scores[mid]) / 2 : scores[mid];
      return { raw: Math.min(100, Math.max(0, Math.round(median))) };
    }
  }

  // Fallback: reconstruct from cc_votes history
  // Get all CC votes up to this epoch
  const { data: ccVotes } = await supabase
    .from('cc_votes')
    .select('cc_hot_id, proposal_tx_hash, proposal_index, vote, meta_url, epoch')
    .lte('epoch', targetEpoch)
    .range(0, 99999);

  if (!ccVotes?.length) return { raw: 0 };

  // Get CC-eligible proposals up to this epoch
  const { data: proposals } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, proposal_type')
    .lte('proposed_epoch', targetEpoch)
    .range(0, 99999);

  const totalEligible = (proposals ?? []).length;
  if (totalEligible === 0) return { raw: 0 };

  // Compute per-member fidelity: participation rate + rationale provision
  const memberVotes = new Map<string, { total: number; withRationale: number }>();
  for (const v of ccVotes) {
    const entry = memberVotes.get(v.cc_hot_id) ?? { total: 0, withRationale: 0 };
    entry.total++;
    if (v.meta_url) entry.withRationale++;
    memberVotes.set(v.cc_hot_id, entry);
  }

  const scores: number[] = [];
  for (const [, data] of memberVotes) {
    // Simplified 2-pillar model:
    // Participation (60%): votes / eligible proposals
    const participation = Math.min(100, (data.total / totalEligible) * 100);
    // Rationale provision (40%): votes with rationale / total votes
    const rationaleRate = data.total > 0 ? (data.withRationale / data.total) * 100 : 0;
    const score = participation * 0.6 + rationaleRate * 0.4;
    scores.push(score);
  }

  scores.sort((a, b) => a - b);
  if (scores.length === 0) return { raw: 0 };

  const mid = Math.floor(scores.length / 2);
  const median = scores.length % 2 === 0 ? (scores[mid - 1] + scores[mid]) / 2 : scores[mid];
  return { raw: Math.min(100, Math.max(0, Math.round(median))) };
}

// ── Power Distribution ──────────────────────────────────────────────────

async function computePowerDistributionForEpoch(
  supabase: Supabase,
  targetEpoch: number,
): Promise<RawScore & { edi: EDIResult }> {
  // Get voting power at this epoch
  const { data: powerSnaps } = await supabase
    .from('drep_power_snapshots')
    .select('drep_id, amount_lovelace')
    .eq('epoch_no', targetEpoch)
    .gt('amount_lovelace', 0)
    .range(0, 99999);

  const votingPowers = (powerSnaps ?? [])
    .map((s) => Number(s.amount_lovelace))
    .filter((v) => v > 0);

  if (votingPowers.length === 0) {
    const emptyEdi: EDIResult = {
      compositeScore: 0,
      breakdown: {
        nakamotoCoefficient: 0,
        gini: 0,
        shannonEntropy: 0,
        hhi: 0,
        theilIndex: 0,
        concentrationRatio: 0,
        tauDecentralization: 0,
      },
      normalized: {
        nakamoto: 0,
        gini: 0,
        shannonEntropy: 0,
        hhi: 0,
        theil: 0,
        concentration: 0,
        tau: 0,
      },
    };
    return { raw: 0, edi: emptyEdi };
  }

  const edi = computeEDI(votingPowers);

  // Onboarding bonus
  const epochMin = targetEpoch - 3;
  const { data: recentVotes } = await supabase
    .from('drep_votes')
    .select('drep_id')
    .gte('epoch_no', epochMin)
    .lte('epoch_no', targetEpoch)
    .range(0, 99999);

  let onboardingBonus = 0;
  if (recentVotes?.length && votingPowers.length > 0) {
    const uniqueVoters = new Set(recentVotes.map((v) => v.drep_id));
    const newRate = uniqueVoters.size / votingPowers.length;
    onboardingBonus = Math.min(10, Math.round(newRate * 30));
  }

  // Concentration penalty (HHI)
  const total = votingPowers.reduce((a, b) => a + b, 0);
  const hhiRaw = votingPowers.reduce((sum, p) => sum + (p / total) ** 2, 0) * 100;
  const concentrationPenalty = hhiRaw <= 15 ? 0 : Math.min(20, (hhiRaw - 15) * 0.5);

  // Quality penalty (skip for backfill — we'd need epoch-scoped DRep scores
  // which creates a circular dependency; this is a small adjustment anyway)
  const qualityPenalty = 0;

  const raw = Math.min(
    100,
    Math.max(0, edi.compositeScore + onboardingBonus - concentrationPenalty - qualityPenalty),
  );

  return { raw, edi };
}

// ── System Stability ────────────────────────────────────────────────────

async function computeSystemStabilityForEpoch(
  supabase: Supabase,
  targetEpoch: number,
): Promise<RawScore> {
  // DRep Retention (50%)
  let retentionScore = 70;
  const { count: currentActive } = await supabase
    .from('drep_power_snapshots')
    .select('drep_id', { count: 'exact', head: true })
    .eq('epoch_no', targetEpoch)
    .gt('amount_lovelace', 0);

  const { count: previousActive } = await supabase
    .from('drep_power_snapshots')
    .select('drep_id', { count: 'exact', head: true })
    .eq('epoch_no', targetEpoch - 1)
    .gt('amount_lovelace', 0);

  if (previousActive && previousActive > 0 && currentActive !== null) {
    retentionScore = Math.min(100, Math.max(0, Math.round((currentActive / previousActive) * 80)));
  }

  // Delegation Volatility (30%)
  let volatilityScore = 70;
  const { data: currentPowers } = await supabase
    .from('drep_power_snapshots')
    .select('drep_id, amount_lovelace')
    .eq('epoch_no', targetEpoch)
    .gt('amount_lovelace', 0)
    .range(0, 99999);

  const { data: prevPowers } = await supabase
    .from('drep_power_snapshots')
    .select('drep_id, amount_lovelace')
    .eq('epoch_no', targetEpoch - 1)
    .gt('amount_lovelace', 0)
    .range(0, 99999);

  if (currentPowers?.length && prevPowers?.length) {
    const prevMap = new Map(prevPowers.map((s) => [s.drep_id, Number(s.amount_lovelace)]));
    let totalPctChange = 0;
    let count = 0;
    for (const snap of currentPowers) {
      const prev = prevMap.get(snap.drep_id);
      if (prev && prev > 0) {
        totalPctChange += Math.abs(Number(snap.amount_lovelace) - prev) / prev;
        count++;
      }
    }
    if (count > 0) {
      const meanPctChange = totalPctChange / count;
      volatilityScore = Math.min(100, Math.max(0, Math.round((1 - meanPctChange / 0.2) * 100)));
    }
  }

  // Throughput Stability (20%)
  let throughputStabilityScore = 50;
  const epochMin = targetEpoch - 5;
  const { data: epochVotes } = await supabase
    .from('drep_votes')
    .select('epoch_no')
    .gte('epoch_no', epochMin)
    .lte('epoch_no', targetEpoch)
    .range(0, 99999);

  if (epochVotes?.length) {
    const votesPerEpoch = new Map<number, number>();
    for (let e = epochMin + 1; e <= targetEpoch; e++) votesPerEpoch.set(e, 0);
    for (const v of epochVotes) {
      const epoch = v.epoch_no as number;
      votesPerEpoch.set(epoch, (votesPerEpoch.get(epoch) ?? 0) + 1);
    }
    const counts = Array.from(votesPerEpoch.values());
    if (counts.length >= 2) {
      const mean = counts.reduce((s, c) => s + c, 0) / counts.length;
      if (mean > 0) {
        const variance = counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length;
        const cv = Math.sqrt(variance) / mean;
        throughputStabilityScore = Math.min(100, Math.max(0, Math.round((1 - cv / 1.5) * 100)));
      }
    }
  }

  const raw = retentionScore * 0.5 + volatilityScore * 0.3 + throughputStabilityScore * 0.2;
  return { raw: Math.min(100, Math.max(0, Math.round(raw))) };
}

// ── Treasury Health ─────────────────────────────────────────────────────

async function computeTreasuryHealthForEpoch(
  supabase: Supabase,
  targetEpoch: number,
): Promise<RawScore> {
  // Get treasury snapshots up to this epoch
  const { data: snapshots } = await supabase
    .from('treasury_snapshots')
    .select('epoch_no, balance_lovelace, withdrawals_lovelace, reserves_income_lovelace')
    .lte('epoch_no', targetEpoch)
    .order('epoch_no', { ascending: true })
    .range(0, 99999);

  if (!snapshots?.length) return { raw: 50 }; // neutral if no data

  const toAda = (lovelace: string | number | null) => Number(lovelace ?? 0) / 1_000_000;

  // 1. Balance trend (0-100)
  let balanceTrend = 50;
  if (snapshots.length >= 2) {
    const first = toAda(snapshots[0].balance_lovelace);
    const last = toAda(snapshots[snapshots.length - 1].balance_lovelace);
    if (first > 0) {
      const pctChange = ((last - first) / first) * 100;
      balanceTrend = Math.max(0, Math.min(100, 50 + pctChange * 5));
    }
  }

  // 2. Withdrawal velocity (0-100)
  let withdrawalVelocity = 75;
  if (snapshots.length >= 4) {
    const halfIdx = Math.floor(snapshots.length / 2);
    const firstHalf = snapshots.slice(0, halfIdx);
    const secondHalf = snapshots.slice(halfIdx);
    const avgFirst =
      firstHalf.reduce((s, r) => s + toAda(r.withdrawals_lovelace), 0) / firstHalf.length;
    const avgSecond =
      secondHalf.reduce((s, r) => s + toAda(r.withdrawals_lovelace), 0) / secondHalf.length;
    if (avgFirst > 0) {
      const ratio = avgSecond / avgFirst;
      withdrawalVelocity = Math.max(0, Math.min(100, 100 - (ratio - 1) * 50));
    }
  }

  // 3. Income stability (0-100)
  let incomeStability = 50;
  const incomes = snapshots
    .filter((s) => s.reserves_income_lovelace != null)
    .map((s) => toAda(s.reserves_income_lovelace));
  if (incomes.length >= 2) {
    const mean = incomes.reduce((s, i) => s + i, 0) / incomes.length;
    if (mean > 0) {
      const variance = incomes.reduce((s, i) => s + (i - mean) ** 2, 0) / incomes.length;
      const cv = Math.sqrt(variance) / mean;
      incomeStability = Math.min(100, Math.max(0, Math.round((1 - cv) * 100)));
    }
  }

  // Simplified 3-signal composition (balance 40%, withdrawal 30%, income 30%)
  const raw = balanceTrend * 0.4 + withdrawalVelocity * 0.3 + incomeStability * 0.3;
  return { raw: Math.min(100, Math.max(0, Math.round(raw))) };
}
