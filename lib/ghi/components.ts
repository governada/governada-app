/**
 * GHI v2 Component Computations
 *
 * 10 components across 4 categories (weights from calibration.ts):
 *   Engagement (32%):     DRep Participation (14%), SPO Participation (9%), Citizen Engagement (9%)
 *   Quality (37%):        Deliberation Quality (14%), Governance Effectiveness (14%), CC Constitutional Fidelity (9%)
 *   Resilience (23%):     Power Distribution (14%), System Stability (9%)
 *   Sustainability (14%): Treasury Health (8%), Governance Outcomes (6%)
 *
 * Each function returns a raw 0-100 score. Calibration is applied externally.
 *
 * All signals measure governance health — no platform infrastructure metrics
 * are included. This ensures GHI is defensible under public scrutiny.
 */

import { createClient } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabase';
import { calculateTreasuryHealthScore } from '@/lib/treasury';
import { computeEDI, type EDIResult } from './ediMetrics';
import { computePairwiseDiversity } from '@/lib/embeddings/quality';
import { cosineSimilarity } from '@/lib/embeddings/query';

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

/** Threshold in minutes — if dreps sync is older than this, carry forward last known-good GHI value */
const DREP_STALE_THRESHOLD_MINS = 720; // 12 hours (matches health endpoint threshold)

export async function computeDRepParticipation({
  supabase,
}: ComponentInput): Promise<ComponentScore> {
  // Staleness guard: check if dreps data is fresh before computing
  const { data: syncHealth } = await supabase
    .from('v_sync_health')
    .select('last_run, last_success')
    .eq('sync_type', 'dreps')
    .maybeSingle();

  if (syncHealth?.last_run) {
    const staleMins = Math.round((Date.now() - new Date(syncHealth.last_run).getTime()) / 60_000);
    const isStale = staleMins > DREP_STALE_THRESHOLD_MINS || syncHealth.last_success === false;

    if (isStale) {
      // Carry forward from last known-good GHI snapshot
      const { data: lastSnapshot } = await supabase
        .from('ghi_snapshots')
        .select('components')
        .order('epoch_no', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastSnapshot?.components) {
        const comps = lastSnapshot.components as Array<{
          name: string;
          value: number;
          weight: number;
        }>;
        const prev = comps.find((c) => c.name === 'DRep Participation');
        if (prev) {
          return {
            raw: prev.value,
            detail: { carriedForward: 1, staleMinutes: staleMins, originalValue: prev.value },
          };
        }
      }
      // No snapshot to carry forward — fall through to live computation (better than returning 0)
    }
  }

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

  // --- Check if embedding data is available (data-driven, no feature flag) ---
  let semanticDiversityScore = 0;
  let reasoningCoherenceScore = 0;
  let embeddingsAvailable = false;

  try {
    const adminSupabase = getSupabaseAdmin();
    // --- Sub-signal 4: Semantic Argument Diversity (embedding-based) ---
    // Get all rationale embeddings for recent proposals and compute pairwise diversity
    const { data: rationaleEmbeddings } = await adminSupabase
      .from('embeddings')
      .select('entity_id, secondary_id, embedding')
      .eq('entity_type', 'rationale')
      .limit(500);

    if (rationaleEmbeddings?.length && rationaleEmbeddings.length >= 2) {
      embeddingsAvailable = true;

      // Group by proposal (entity_id contains tx_hash:index)
      const proposalGroups = new Map<string, number[][]>();
      for (const re of rationaleEmbeddings) {
        // Extract proposal key from entity_id (format: "tx_hash:index")
        const proposalKey = re.entity_id;
        const group = proposalGroups.get(proposalKey) ?? [];
        group.push(re.embedding as unknown as number[]);
        proposalGroups.set(proposalKey, group);
      }

      // Compute diversity per proposal, then average
      let totalDiversity = 0;
      let proposalCount = 0;
      for (const embeddings of proposalGroups.values()) {
        if (embeddings.length >= 2) {
          totalDiversity += computePairwiseDiversity(embeddings);
          proposalCount++;
        }
      }

      if (proposalCount > 0) {
        // Pairwise diversity returns 0-1 (1 = maximally diverse). Scale to 0-100.
        semanticDiversityScore = Math.round((totalDiversity / proposalCount) * 100);
      }

      // --- Sub-signal 5: Reasoning Coherence (rationale-proposal relevance) ---
      // For each rationale, compute similarity to its proposal's embedding
      const { data: proposalEmbeddings } = await adminSupabase
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
            // Cosine similarity ranges -1 to 1; map to 0-100
            totalCoherence += Math.max(0, similarity) * 100;
            coherenceCount++;
          }
        }

        if (coherenceCount > 0) {
          reasoningCoherenceScore = Math.round(totalCoherence / coherenceCount);
        }
      }
    }
  } catch {
    // If embeddings query fails, fall back gracefully to 3-signal version
    embeddingsAvailable = false;
  }

  // --- Compose final score ---
  // When embeddings are available, use the full 5-signal composition.
  // When not available (data not yet computed for this epoch), fall back to 3-signal.
  let raw: number;
  if (embeddingsAvailable) {
    raw =
      rationaleScore * 0.25 +
      debateDiversityScore * 0.15 +
      independenceScore * 0.1 +
      semanticDiversityScore * 0.3 +
      reasoningCoherenceScore * 0.2;
  } else {
    // Fallback 3-signal composition (no embeddings data for this epoch)
    raw = rationaleScore * 0.5 + debateDiversityScore * 0.3 + independenceScore * 0.2;
  }

  return {
    raw: Math.min(100, Math.max(0, Math.round(raw))),
    detail: {
      rationaleQuality: Math.round(rationaleScore),
      debateDiversity: Math.round(debateDiversityScore),
      votingIndependence: Math.round(independenceScore),
      ...(embeddingsAvailable && {
        semanticDiversity: semanticDiversityScore,
        reasoningCoherence: reasoningCoherenceScore,
      }),
      embeddingsAvailable: embeddingsAvailable ? 1 : 0,
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

/**
 * Compute HHI-based delegation concentration penalty.
 * Penalizes the Power Distribution score when voting power is concentrated
 * among a small number of DReps (anti-whale check).
 *
 * HHI = sum(share_i^2) where share_i = drep_power / total_delegated_power
 * Normalized to 0-100 scale. Penalty applied when HHI > 15 (moderately concentrated).
 */
function computeDelegationConcentrationPenalty(drepPowers: number[]): number {
  const total = drepPowers.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  const shares = drepPowers.map((p) => p / total);
  const hhiRaw = shares.reduce((sum, s) => sum + s * s, 0);

  // HHI ranges from 1/N (perfect distribution) to 1 (monopoly)
  // Normalize: 0 = perfectly distributed, 100 = single entity
  const normalizedHHI = hhiRaw * 100;

  // Penalty: if HHI > 15 (moderately concentrated), start penalizing
  if (normalizedHHI <= 15) return 0;
  return Math.min(20, (normalizedHHI - 15) * 0.5); // max 20 point penalty
}

/**
 * Compute quality-weighted EDI adjustment.
 * Prevents "hollow diversity" — many DReps registered but most are low-quality/inactive.
 * Penalizes when >50% of total voting power is held by Emerging-tier DReps (score < 40).
 */
function computeQualityDistributionPenalty(
  drepScores: Array<{ score: number; votingPower: number }>,
): number {
  const totalPower = drepScores.reduce((sum, d) => sum + d.votingPower, 0);
  if (totalPower === 0) return 0;

  const emergingPower = drepScores
    .filter((d) => d.score < 40)
    .reduce((sum, d) => sum + d.votingPower, 0);

  const emergingPowerShare = emergingPower / totalPower;

  if (emergingPowerShare > 0.5) return 15;
  if (emergingPowerShare > 0.3) return 10;
  return 0;
}

export async function computePowerDistribution({
  supabase,
  currentEpoch,
}: ComponentInput): Promise<ComponentScore & { edi: EDIResult }> {
  const { data: dreps } = await supabase
    .from('dreps')
    .select('id, info, score')
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

  // Anti-whale: HHI delegation concentration penalty
  const concentrationPenalty = computeDelegationConcentrationPenalty(votingPowers);

  // Quality-weighted EDI: penalize hollow diversity (many DReps but mostly low-quality)
  const drepScoresWithPower = activeDreps
    .map((d) => ({
      score: (d.score as number) ?? 0,
      votingPower: parseInt(
        String((d.info as Record<string, unknown> | null)?.votingPowerLovelace || '0'),
        10,
      ),
    }))
    .filter((d) => d.votingPower > 0);
  const qualityPenalty = computeQualityDistributionPenalty(drepScoresWithPower);

  const raw = Math.min(
    100,
    Math.max(0, edi.compositeScore + onboardingBonus - concentrationPenalty - qualityPenalty),
  );

  return {
    raw,
    edi,
    detail: {
      ediComposite: edi.compositeScore,
      onboardingBonus,
      concentrationPenalty: Math.round(concentrationPenalty),
      qualityPenalty,
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
//
// Measures whether governance activity is stable and sustainable.
// Three pure governance signals — no platform infrastructure metrics.
//
// Sub-signals:
//   1. DRep Retention (50%) — Are DReps staying active epoch-over-epoch?
//   2. Score Volatility (30%) — Are individual scores stable (not chaotic)?
//   3. Governance Throughput Stability (20%) — Is the volume of governance
//      actions (votes cast) consistent across epochs? A healthy governance
//      system has steady participation, not wild swings.
//
// Note: This component previously included "Infrastructure Health" which
// measured Governada's sync pipeline status. That was removed because it
// measured platform reliability, not governance health — a self-referential
// signal that would not survive public scrutiny.
// ---------------------------------------------------------------------------

export async function computeSystemStability({
  supabase,
  currentEpoch,
}: ComponentInput): Promise<ComponentScore> {
  // --- Sub-signal 1: DRep Retention (50%) ---
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

  // --- Sub-signal 2: Score Volatility (30%) ---
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
      volatilityScore = Math.min(100, Math.max(0, Math.round((1 - meanAbsDelta / 20) * 100)));
    }
  }

  // --- Sub-signal 3: Governance Throughput Stability (20%) ---
  // Coefficient of variation (CV) of votes-per-epoch over a 5-epoch window.
  // CV = 0 → perfectly stable (score 100)
  // CV ≥ 1.5 → highly volatile (score 0)
  // Sweet spot: CV < 0.3 = very stable, 0.3-0.7 = moderate, > 1.0 = unstable
  let throughputStabilityScore = 50; // neutral default
  const epochWindow = 5;
  const epochMin = currentEpoch - epochWindow;

  const { data: epochVotes } = await supabase
    .from('drep_votes')
    .select('epoch_no')
    .gte('epoch_no', epochMin);

  if (epochVotes?.length) {
    const votesPerEpoch = new Map<number, number>();
    for (let e = epochMin + 1; e <= currentEpoch; e++) {
      votesPerEpoch.set(e, 0);
    }
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

  return {
    raw: Math.min(100, Math.max(0, Math.round(raw))),
    detail: {
      drepRetention: Math.round(retentionScore),
      scoreVolatility: Math.round(volatilityScore),
      throughputStability: Math.round(throughputStabilityScore),
    },
  };
}

// ---------------------------------------------------------------------------
// 2J. Governance Outcomes (6%) — feature flagged
//
// Closes the governance value loop: proposals → deliberation → decision → outcome.
// Without this, GHI measures process health but not whether governance
// produces positive results for Cardano.
//
// Sub-signals:
//   1. Delivery Rate (40%) — What fraction of enacted proposals have delivered?
//   2. Community Satisfaction (30%) — Would voters approve again? (poll-based)
//   3. Treasury Efficiency (30%) — Delivery quality weighted by ADA amount
//      for treasury withdrawals (are we getting ROI on governance spending?)
//
// Requires sufficient enacted proposals with outcome data to produce
// meaningful scores. Feature flagged via `ghi_governance_outcomes`.
// ---------------------------------------------------------------------------

export async function computeGovernanceOutcomes({
  supabase,
}: ComponentInput): Promise<ComponentScore> {
  // Fetch all proposals with outcome tracking data
  const { data: outcomes } = await supabase
    .from('proposal_outcomes')
    .select(
      'proposal_tx_hash, proposal_index, delivery_status, delivery_score, would_approve_again_pct, total_poll_responses',
    )
    .not('delivery_status', 'eq', 'unknown');

  if (!outcomes?.length) return { raw: 0, detail: { evaluatedProposals: 0 } };

  // Only score proposals with substantive data (not just lifecycle status)
  const evaluated = outcomes.filter(
    (o) =>
      o.delivery_status !== 'in_progress' &&
      (o.total_poll_responses > 0 || o.delivery_status === 'delivered'),
  );

  if (evaluated.length === 0) {
    return { raw: 0, detail: { evaluatedProposals: 0, totalOutcomes: outcomes.length } };
  }

  // --- Sub-signal 1: Delivery Rate (40%) ---
  // What fraction of evaluated proposals were delivered or partially delivered?
  const delivered = evaluated.filter(
    (o) => o.delivery_status === 'delivered' || o.delivery_status === 'partial',
  ).length;
  const deliveryRate = (delivered / evaluated.length) * 100;

  // --- Sub-signal 2: Community Satisfaction (30%) ---
  // Average "would approve again" percentage across evaluated proposals with poll data
  const withPolls = evaluated.filter(
    (o) => o.would_approve_again_pct != null && o.total_poll_responses > 0,
  );
  let satisfactionScore = 50; // neutral default
  if (withPolls.length > 0) {
    satisfactionScore =
      withPolls.reduce((sum, o) => sum + (o.would_approve_again_pct ?? 50), 0) / withPolls.length;
  }

  // --- Sub-signal 3: Treasury Efficiency (30%) ---
  // Average delivery score across all evaluated proposals with scores
  // This is already weighted by poll quality in the proposal outcomes computation
  const withScores = evaluated.filter((o) => o.delivery_score != null);
  let efficiencyScore = 50; // neutral default
  if (withScores.length > 0) {
    efficiencyScore =
      withScores.reduce((sum, o) => sum + (o.delivery_score ?? 0), 0) / withScores.length;
  }

  const raw = deliveryRate * 0.4 + satisfactionScore * 0.3 + efficiencyScore * 0.3;

  return {
    raw: Math.min(100, Math.max(0, Math.round(raw))),
    detail: {
      evaluatedProposals: evaluated.length,
      totalOutcomes: outcomes.length,
      deliveryRate: Math.round(deliveryRate),
      communitySatisfaction: Math.round(satisfactionScore),
      treasuryEfficiency: Math.round(efficiencyScore),
      deliveredCount: delivered,
    },
  };
}
