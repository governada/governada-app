/**
 * Proposer Score Engine
 *
 * 4-pillar scoring model for governance proposers:
 *   1. Track Record (35%)  — approval rate + delivery + trajectory
 *   2. Proposal Quality (30%) — AI quality (60%) + spec completeness (20%) + engagement (20%)
 *   3. Fiscal Responsibility (20%) — enacted rate + delivery + budget quality (treasury)
 *   4. Governance Citizenship (15%) — type diversity + completeness + sustained engagement
 *
 * Uses absolute calibration curves (same as DRep/SPO/CC scores).
 * Confidence-gated: 1 = max Emerging, 2-3 = max Bronze, 4-6 = max Silver, 7+ = full.
 *
 * Anti-gaming:
 *   - Serial low-effort detection (3+ proposals with AI quality < 30 → 0.85x citizenship)
 *   - InfoAction-only proposers capped at 60 raw track record
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { calibrate, type CalibrationCurve } from '@/lib/scoring/calibration';
import { dampenPillarScore } from '@/lib/scoring/confidence';
import { logger } from '@/lib/logger';
import type { ProposalQualityResult } from './proposalQuality';

// ---------------------------------------------------------------------------
// Weights & Calibration
// ---------------------------------------------------------------------------

export const PROPOSER_PILLAR_WEIGHTS = {
  trackRecord: 0.35,
  proposalQuality: 0.3,
  fiscalResponsibility: 0.2,
  governanceCitizenship: 0.15,
} as const;

/**
 * Calibration curves for proposer score pillars.
 *
 * Track Record:
 * - floor (15): ~15% approval rate, 1 enacted out of many.
 * - targetLow (40): ~40% approval rate, some enacted, no delivery data yet.
 * - targetHigh (70): ~70% approval rate, good track record.
 * - ceiling (90): 90%+ approval with delivery evidence.
 */
export const PROPOSER_CALIBRATION: Record<string, CalibrationCurve> = {
  trackRecord: { floor: 15, targetLow: 40, targetHigh: 70, ceiling: 90 },
  proposalQuality: { floor: 20, targetLow: 40, targetHigh: 65, ceiling: 85 },
  fiscalResponsibility: { floor: 15, targetLow: 35, targetHigh: 65, ceiling: 85 },
  governanceCitizenship: { floor: 10, targetLow: 30, targetHigh: 60, ceiling: 80 },
};

/**
 * Confidence tiers based on proposal count.
 * Graduated system: requires 7+ proposals for uncapped confidence (similar
 * to DRep's 15+ votes requirement).
 */
const CONFIDENCE_TIERS = [
  { maxProposals: 1, confidence: 40, maxTier: 'Emerging' },
  { maxProposals: 3, confidence: 60, maxTier: 'Bronze' },
  { maxProposals: 6, confidence: 80, maxTier: 'Silver' },
] as const;

const TIER_BOUNDARIES = [
  { name: 'Emerging', min: 0, max: 39 },
  { name: 'Bronze', min: 40, max: 54 },
  { name: 'Silver', min: 55, max: 69 },
  { name: 'Gold', min: 70, max: 84 },
  { name: 'Diamond', min: 85, max: 94 },
  { name: 'Legendary', min: 95, max: 100 },
] as const;

// ---------------------------------------------------------------------------
// Anti-gaming constants
// ---------------------------------------------------------------------------

/** Threshold for "low effort" AI quality score */
const LOW_EFFORT_AI_THRESHOLD = 30;
/** Minimum proposals needed to trigger low-effort pattern detection */
const LOW_EFFORT_MIN_PROPOSALS = 3;
/** Multiplier applied to citizenship pillar when low-effort pattern detected */
const LOW_EFFORT_CITIZENSHIP_MULTIPLIER = 0.85;
/** Cap on track record raw score for InfoAction-only proposers */
const INFOACTION_ONLY_TRACK_RECORD_CAP = 60;

// ---------------------------------------------------------------------------
// Pillar computations
// ---------------------------------------------------------------------------

export interface ProposerData {
  id: string;
  proposalCount: number;
  enactedCount: number;
  droppedCount: number;
  proposals: {
    txHash: string;
    proposalIndex: number;
    proposalType: string;
    withdrawalAmount: number | null;
    hasAbstract: boolean;
    hasBody: boolean;
    proposedEpoch: number | null;
    enacted: boolean;
    dropped: boolean;
    voteCount: number;
    deliveryScore: number | null;
  }[];
}

/** AI-scored quality results keyed by "txHash-proposalIndex" */
export type AIQualityMap = Map<string, ProposalQualityResult>;
/** AI-scored budget quality results keyed by "txHash-proposalIndex" */
export type BudgetQualityMap = Map<string, number>;

function computeTrackRecord(data: ProposerData): number {
  if (data.proposalCount === 0) return 0;

  // Exclude InfoActions from approval rate (non-binding)
  const actionable = data.proposals.filter((p) => p.proposalType !== 'InfoAction');

  // Anti-gaming: InfoAction-only proposers get capped track record
  if (actionable.length === 0 && data.proposals.length > 0) {
    return Math.min(50, INFOACTION_ONLY_TRACK_RECORD_CAP);
  }

  if (actionable.length === 0) return 50;

  // Sub-signal 1: Approval rate (60%)
  const enacted = actionable.filter((p) => p.enacted).length;
  const approvalRate = (enacted / actionable.length) * 100;

  // Sub-signal 2: Delivery score (25%) — from proposal_outcomes
  const withDelivery = data.proposals.filter((p) => p.deliveryScore !== null);
  let deliveryScore = 50; // neutral when no data
  if (withDelivery.length > 0) {
    deliveryScore =
      withDelivery.reduce((s, p) => s + (p.deliveryScore ?? 0), 0) / withDelivery.length;
  }

  // Sub-signal 3: Volume bonus (15%) — more proposals = more experience
  // 1 proposal = 20, 3 = 50, 5 = 70, 10+ = 100
  const volumeScore = Math.min(100, 20 + (data.proposalCount - 1) * 13);

  let raw = approvalRate * 0.6 + deliveryScore * 0.25 + volumeScore * 0.15;

  // Anti-gaming: Cap track record if ALL proposals are InfoActions
  // (prevents gaming approval rate via non-binding, always-pass proposals)
  if (actionable.length === 0 && data.proposals.length > 0) {
    raw = Math.min(raw, INFOACTION_ONLY_TRACK_RECORD_CAP);
  }

  return raw;
}

/**
 * Compute Proposal Quality pillar.
 *
 * When AI quality scores are available:
 *   AI quality (60%) + specification completeness (20%) + community engagement (20%)
 *
 * Fallback (AI unavailable):
 *   specification completeness (50%) + community engagement (50%)
 */
function computeProposalQuality(data: ProposerData, aiQuality: AIQualityMap): number {
  if (data.proposals.length === 0) return 0;

  // Sub-signal: Specification completeness
  let completenessTotal = 0;
  for (const p of data.proposals) {
    let score = 30; // base: has title + author (they're in the system)
    if (p.hasAbstract) score += 35;
    if (p.hasBody) score += 35;
    completenessTotal += score;
  }
  const completeness = completenessTotal / data.proposals.length;

  // Sub-signal: Community engagement
  let engagementTotal = 0;
  for (const p of data.proposals) {
    // Vote count scoring: 0 votes = 0, 10 = 40, 30 = 70, 50+ = 100
    const voteScore = Math.min(100, p.voteCount * 2);
    engagementTotal += voteScore;
  }
  const engagement = engagementTotal / data.proposals.length;

  // Sub-signal: AI quality (average across proposals with AI scores)
  let aiScoreTotal = 0;
  let aiScoreCount = 0;
  for (const p of data.proposals) {
    const key = `${p.txHash}-${p.proposalIndex}`;
    const aiResult = aiQuality.get(key);
    if (aiResult) {
      aiScoreTotal += aiResult.score;
      aiScoreCount++;
    }
  }

  // If we have AI scores for at least one proposal, use AI-weighted formula
  if (aiScoreCount > 0) {
    const avgAiScore = aiScoreTotal / aiScoreCount;
    return avgAiScore * 0.6 + completeness * 0.2 + engagement * 0.2;
  }

  // Fallback: original weights when AI is unavailable
  return completeness * 0.5 + engagement * 0.5;
}

/**
 * Compute Fiscal Responsibility pillar.
 *
 * For treasury proposers with AI budget quality scores:
 *   enacted rate (50%) + delivery (30%) + budget quality (20%)
 *
 * Fallback (no AI or non-treasury):
 *   enacted rate (60%) + delivery (40%)
 */
function computeFiscalResponsibility(data: ProposerData, budgetQuality: BudgetQualityMap): number {
  const treasuryProposals = data.proposals.filter((p) => p.proposalType === 'TreasuryWithdrawals');

  // Non-treasury proposers get neutral score
  if (treasuryProposals.length === 0) return 50;

  // Sub-signal 1: Enacted rate for treasury asks
  const enacted = treasuryProposals.filter((p) => p.enacted).length;
  const enactedRate = (enacted / treasuryProposals.length) * 100;

  // Sub-signal 2: Delivery on funded proposals
  const funded = treasuryProposals.filter((p) => p.enacted);
  const withDelivery = funded.filter((p) => p.deliveryScore !== null);
  let deliveryScore = 50; // neutral when no delivery data
  if (withDelivery.length > 0) {
    deliveryScore =
      withDelivery.reduce((s, p) => s + (p.deliveryScore ?? 0), 0) / withDelivery.length;
  }

  // Sub-signal 3: AI budget quality (average across treasury proposals with scores)
  let budgetTotal = 0;
  let budgetCount = 0;
  for (const p of treasuryProposals) {
    const key = `${p.txHash}-${p.proposalIndex}`;
    const bq = budgetQuality.get(key);
    if (bq !== undefined) {
      budgetTotal += bq;
      budgetCount++;
    }
  }

  if (budgetCount > 0) {
    const avgBudgetQuality = budgetTotal / budgetCount;
    return enactedRate * 0.5 + deliveryScore * 0.3 + avgBudgetQuality * 0.2;
  }

  // Fallback: original weights when AI budget scoring is unavailable
  return enactedRate * 0.6 + deliveryScore * 0.4;
}

function computeGovernanceCitizenship(data: ProposerData): number {
  // Sub-signal 1: Proposal type diversity (40%)
  // Proposers who engage across multiple governance areas show broader citizenship
  const types = new Set(data.proposals.map((p) => p.proposalType));
  const diversityScore = Math.min(100, types.size * 30); // 1 type=30, 2=60, 3+=90

  // Sub-signal 2: Proposal completeness (30%)
  // Treating specification quality as a citizenship signal — putting effort in
  const withBody = data.proposals.filter((p) => p.hasBody).length;
  const bodyRate = (withBody / data.proposals.length) * 100;

  // Sub-signal 3: Sustained engagement (30%)
  // Proposers who submit across multiple epochs show commitment
  const uniqueEpochs = new Set(
    data.proposals.map((p) => p.proposedEpoch).filter((e): e is number => e !== null),
  );
  const sustainedScore = Math.min(100, uniqueEpochs.size * 25); // 1 epoch=25, 2=50, 4+=100

  // TODO: Community Responsiveness Signal — when on-chain proposals can be linked to
  // draft_reviews (workspace reviews), add a responsiveness sub-signal here:
  // Did the proposer iterate on their proposal after receiving community review feedback?
  // Currently draft_reviews links to proposal_drafts, not on-chain proposals.

  return diversityScore * 0.4 + bodyRate * 0.3 + sustainedScore * 0.3;
}

// ---------------------------------------------------------------------------
// Anti-gaming
// ---------------------------------------------------------------------------

/**
 * Detect serial low-effort proposal pattern.
 * If a proposer has 3+ proposals with AI quality score < 30, they're flagged.
 */
function hasLowEffortPattern(
  proposals: ProposerData['proposals'],
  aiQuality: AIQualityMap,
): boolean {
  let lowEffortCount = 0;
  for (const p of proposals) {
    const key = `${p.txHash}-${p.proposalIndex}`;
    const aiResult = aiQuality.get(key);
    if (aiResult && aiResult.score < LOW_EFFORT_AI_THRESHOLD) {
      lowEffortCount++;
    }
  }
  return lowEffortCount >= LOW_EFFORT_MIN_PROPOSALS;
}

// ---------------------------------------------------------------------------
// Confidence & Tier
// ---------------------------------------------------------------------------

function computeConfidence(proposalCount: number): number {
  for (const tier of CONFIDENCE_TIERS) {
    if (proposalCount <= tier.maxProposals) return tier.confidence;
  }
  return 100;
}

function getTier(score: number, proposalCount: number): string {
  // Apply confidence cap
  for (const cap of CONFIDENCE_TIERS) {
    if (proposalCount <= cap.maxProposals) {
      const maxTierBoundary = TIER_BOUNDARIES.find((t) => t.name === cap.maxTier);
      if (maxTierBoundary) {
        // Find the tier for the actual score, but cap it
        const actualTier = TIER_BOUNDARIES.find((t) => score >= t.min && score <= t.max);
        const actualIdx = TIER_BOUNDARIES.findIndex((t) => t.name === actualTier?.name);
        const capIdx = TIER_BOUNDARIES.findIndex((t) => t.name === cap.maxTier);
        if (actualIdx > capIdx) return cap.maxTier;
      }
    }
  }
  return TIER_BOUNDARIES.find((t) => score >= t.min && score <= t.max)?.name ?? 'Emerging';
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

/**
 * Compute scores for all proposers and update the database.
 * Called by the Inngest sync pipeline.
 *
 * @param aiQualityScores - Pre-computed AI quality scores keyed by "txHash-proposalIndex"
 * @param budgetQualityScores - Pre-computed AI budget quality scores keyed by "txHash-proposalIndex"
 */
export async function scoreAllProposers(
  aiQualityScores: AIQualityMap = new Map(),
  budgetQualityScores: BudgetQualityMap = new Map(),
): Promise<{ scored: number }> {
  const supabase = getSupabaseAdmin();

  // 1. Fetch all proposers with their proposal links
  const { data: proposers, error: propErr } = await supabase
    .from('proposers')
    .select('id, proposal_count, enacted_count, dropped_count');

  if (propErr || !proposers?.length) {
    logger.error('[ProposerScore] Failed to fetch proposers', { error: propErr });
    return { scored: 0 };
  }

  let scored = 0;

  for (const proposer of proposers) {
    // 2. Fetch linked proposals with their data
    const { data: links } = await supabase
      .from('proposal_proposers')
      .select('proposal_tx_hash, proposal_index')
      .eq('proposer_id', proposer.id);

    if (!links?.length) continue;

    const txHashes = links.map((l) => l.proposal_tx_hash);

    const { data: proposals } = await supabase
      .from('proposals')
      .select(
        'tx_hash, proposal_index, proposal_type, withdrawal_amount, abstract, proposed_epoch, enacted_epoch, dropped_epoch, expired_epoch, ratified_epoch, meta_json',
      )
      .in('tx_hash', txHashes);

    if (!proposals?.length) continue;

    // 3. Get vote counts per proposal
    const { data: votes } = await supabase
      .from('drep_votes')
      .select('proposal_tx_hash, proposal_index')
      .in('proposal_tx_hash', txHashes);

    const voteCounts = new Map<string, number>();
    for (const v of votes ?? []) {
      const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
      voteCounts.set(key, (voteCounts.get(key) ?? 0) + 1);
    }

    // 4. Get delivery scores
    const { data: outcomes } = await supabase
      .from('proposal_outcomes')
      .select('proposal_tx_hash, proposal_index, delivery_score')
      .in('proposal_tx_hash', txHashes);

    const deliveryScores = new Map<string, number | null>();
    for (const o of outcomes ?? []) {
      deliveryScores.set(`${o.proposal_tx_hash}-${o.proposal_index}`, o.delivery_score);
    }

    // 5. Build proposer data
    const proposerData: ProposerData = {
      id: proposer.id,
      proposalCount: proposer.proposal_count,
      enactedCount: proposer.enacted_count,
      droppedCount: proposer.dropped_count,
      proposals: proposals.map((p) => {
        const key = `${p.tx_hash}-${p.proposal_index}`;
        const meta = p.meta_json as Record<string, unknown> | null;
        return {
          txHash: p.tx_hash,
          proposalIndex: p.proposal_index,
          proposalType: p.proposal_type,
          withdrawalAmount: p.withdrawal_amount ? Number(p.withdrawal_amount) : null,
          hasAbstract: !!(p.abstract && (p.abstract as string).length > 10),
          hasBody: !!(meta && typeof meta.body === 'object' && meta.body !== null),
          proposedEpoch: p.proposed_epoch,
          enacted: !!(p.enacted_epoch || p.ratified_epoch),
          dropped: !!(
            p.dropped_epoch ||
            (p.expired_epoch && !p.enacted_epoch && !p.ratified_epoch)
          ),
          voteCount: voteCounts.get(key) ?? 0,
          deliveryScore: deliveryScores.get(key) ?? null,
        };
      }),
    };

    // 6. Compute pillars (with AI data where available)
    const rawTrackRecord = computeTrackRecord(proposerData);
    const rawQuality = computeProposalQuality(proposerData, aiQualityScores);
    const rawFiscal = computeFiscalResponsibility(proposerData, budgetQualityScores);
    let rawCitizenship = computeGovernanceCitizenship(proposerData);

    // 6a. Anti-gaming: low-effort pattern reduces citizenship score
    if (hasLowEffortPattern(proposerData.proposals, aiQualityScores)) {
      rawCitizenship *= LOW_EFFORT_CITIZENSHIP_MULTIPLIER;
      logger.debug('[ProposerScore] Low-effort pattern detected', {
        proposerId: proposer.id,
      });
    }

    // 7. Calibrate
    const calTrackRecord = calibrate(rawTrackRecord, PROPOSER_CALIBRATION.trackRecord);
    const calQuality = calibrate(rawQuality, PROPOSER_CALIBRATION.proposalQuality);
    const calFiscal = calibrate(rawFiscal, PROPOSER_CALIBRATION.fiscalResponsibility);
    const calCitizenship = calibrate(rawCitizenship, PROPOSER_CALIBRATION.governanceCitizenship);

    // 7a. Confidence dampening: pull pillar scores toward neutral (50) based on
    // proposal count confidence. Low-data proposers get moderated scores.
    const confidence = computeConfidence(proposer.proposal_count);
    const dampTrackRecord = dampenPillarScore(calTrackRecord, confidence);
    const dampQuality = dampenPillarScore(calQuality, confidence);
    const dampFiscal = dampenPillarScore(calFiscal, confidence);
    const dampCitizenship = dampenPillarScore(calCitizenship, confidence);

    // 8. Composite
    const composite = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          dampTrackRecord * PROPOSER_PILLAR_WEIGHTS.trackRecord +
            dampQuality * PROPOSER_PILLAR_WEIGHTS.proposalQuality +
            dampFiscal * PROPOSER_PILLAR_WEIGHTS.fiscalResponsibility +
            dampCitizenship * PROPOSER_PILLAR_WEIGHTS.governanceCitizenship,
        ),
      ),
    );

    const tier = getTier(composite, proposer.proposal_count);

    // 9. Update
    await supabase
      .from('proposers')
      .update({
        composite_score: composite,
        track_record_score: Math.round(calTrackRecord),
        proposal_quality_score: Math.round(calQuality),
        fiscal_responsibility_score: Math.round(calFiscal),
        governance_citizenship_score: Math.round(calCitizenship),
        confidence,
        tier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposer.id);

    scored++;
  }

  logger.info('[ProposerScore] Scoring complete', { scored });
  return { scored };
}
