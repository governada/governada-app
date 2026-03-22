/**
 * Centralized Scoring Calibration Configuration
 *
 * Single source of truth for ALL scoring thresholds, weights, and magic numbers
 * across DRep scoring, SPO scoring, and GHI computation.
 *
 * Every threshold has a documented rationale. Future recalibration is a config
 * change here, not a code change scattered across 10+ files.
 *
 * See docs/methodology/calibration.md for data-backed justification.
 */

// ---------------------------------------------------------------------------
// DRep Score V3 — Pillar Weights
// ---------------------------------------------------------------------------

/**
 * DRep pillar weights (must sum to 1.0).
 *
 * V3.2: EQ raised to 40% (hardest pillar to game — requires actual governance
 * substance), GI reduced to 10% (easiest to game — fill out a form).
 * Shifting weight from gameable to non-gameable pillars makes the composite
 * more resistant to manipulation and more meaningful under public scrutiny.
 */
export const DREP_PILLAR_WEIGHTS = {
  engagementQuality: 0.4,
  effectiveParticipation: 0.25,
  reliability: 0.25,
  governanceIdentity: 0.1,
} as const;

// ---------------------------------------------------------------------------
// DRep Engagement Quality — Layer Weights
// ---------------------------------------------------------------------------

/**
 * Engagement Quality sub-layer weights (must sum to 1.0).
 *
 * Provision (40%): Did they provide a rationale at all?
 * Quality (40%): How good was the rationale (AI-scored)?
 * Deliberation (20%): Vote diversity, dissent, proposal type breadth.
 */
export const ENGAGEMENT_LAYER_WEIGHTS = {
  provision: 0.4,
  quality: 0.4,
  deliberation: 0.2,
} as const;

/**
 * Deliberation sub-signal weights (must sum to 1.0).
 *
 * V3.2: Dissent removed as standalone signal (incentivized strategic contrarianism).
 * Vote diversity replaced by rationale diversity (catches copy-paste, not vote direction).
 * Coverage breadth replaces type breadth (weighted by proposal frequency).
 */
export const DELIBERATION_WEIGHTS = {
  rationaleDiversity: 0.6,
  coverageBreadth: 0.4,
} as const;

/**
 * Rationale diversity config.
 * Measures unique meta_hashes vs total rationales — detects copy-paste rationales.
 * Below minRationales → neutral 50 (insufficient data).
 */
export const RATIONALE_DIVERSITY_CONFIG = {
  /** Minimum rationales with meta_hash to evaluate diversity. */
  minRationales: 3,
  /** Score when below minRationales (neutral). */
  neutralScore: 50,
} as const;

/**
 * Dissent-with-substance modifier config.
 * V3.2: Instead of a standalone dissent signal, dissent is a quality multiplier.
 * When a DRep votes against the majority AND provides a quality rationale (≥ minQuality),
 * their rationale quality contribution for that vote gets a bonus multiplier.
 * Capped to maxVoteFraction of total votes to prevent always-dissent gaming.
 */
export const DISSENT_SUBSTANCE_MODIFIER = {
  /** Multiplier applied to rationale quality for substantive dissent votes. */
  multiplier: 1.2,
  /** Minimum rationale quality score to qualify for the modifier. */
  minQuality: 60,
  /** Maximum fraction of votes that can receive the modifier (prevents gaming). */
  maxVoteFraction: 0.4,
} as const;

// ---------------------------------------------------------------------------
// DRep Effective Participation
// ---------------------------------------------------------------------------

/**
 * Close-margin bonus: proposals decided by <20% margin get 1.5× weight.
 * Rationale: Participating on contentious proposals matters more.
 */
export const CLOSE_MARGIN = {
  threshold: 0.2,
  multiplier: 1.5,
} as const;

/**
 * Importance weight tiers by proposal type.
 */
export const IMPORTANCE_WEIGHTS = {
  critical: 3,
  important: 2,
  standard: 1,
  criticalTypes: [
    'HardForkInitiation',
    'NoConfidence',
    'NewCommittee',
    'NewConstitutionalCommittee',
    'NewConstitution',
    'UpdateConstitution',
  ] as string[],
  importantTypes: ['ParameterChange'] as string[],
  /** Treasury tiers that qualify for important weight. */
  treasuryImportantTiers: ['significant', 'major'] as string[],
  /** Log-scale treasury multiplier cap. */
  treasuryMultiplierCap: 2.4,
  /** Divisor for log10(amount+1) treasury scaling. */
  treasuryLogDivisor: 7,
} as const;

// ---------------------------------------------------------------------------
// DRep Reliability
// ---------------------------------------------------------------------------

/**
 * Reliability sub-component weights (must sum to 1.0).
 * V3.1: Responsiveness (timeliness) removed — voting within the window is sufficient.
 * Weights redistributed: Streak 35%, Recency 30%, Gap 25%, Tenure 10%.
 */
export const RELIABILITY_WEIGHTS = {
  streak: 0.35,
  recency: 0.3,
  gap: 0.25,
  tenure: 0.1,
} as const;

/**
 * Reliability scoring parameters.
 */
export const RELIABILITY_PARAMS = {
  /** Points per consecutive active epoch in streak. */
  streakPointsPerEpoch: 10,
  /** Recency decay: score = 100 * exp(-recency / divisor). */
  recencyDecayDivisor: 5,
  /** Gap penalty: points lost per epoch gap. */
  gapPenaltyPerEpoch: 12,
  /** Tenure asymptote: 20-point floor, 80-point growth. */
  tenureFloor: 20,
  tenureGrowth: 80,
  /** Tenure decay rate (epochs). */
  tenureDecayEpochs: 30,
} as const;

// ---------------------------------------------------------------------------
// DRep Governance Identity
// ---------------------------------------------------------------------------

/**
 * Governance Identity sub-component weights (must sum to 1.0).
 */
export const IDENTITY_WEIGHTS = {
  profileQuality: 0.6,
  communityPresence: 0.4,
} as const;

/**
 * Profile quality field scores.
 */
export const PROFILE_FIELD_SCORES = {
  name: 15,
  objectives: [
    { minLen: 200, pts: 20 },
    { minLen: 50, pts: 15 },
    { minLen: 1, pts: 5 },
  ],
  motivations: [
    { minLen: 200, pts: 15 },
    { minLen: 50, pts: 10 },
    { minLen: 1, pts: 3 },
  ],
  qualifications: [
    { minLen: 100, pts: 10 },
    { minLen: 30, pts: 7 },
    { minLen: 1, pts: 3 },
  ],
  bio: [
    { minLen: 100, pts: 10 },
    { minLen: 30, pts: 7 },
    { minLen: 1, pts: 3 },
  ],
  socialLinks: { twoOrMore: 30, one: 25 },
  hashVerified: 5,
} as const;

// ---------------------------------------------------------------------------
// SPO Score V3 — Pillar Weights
// ---------------------------------------------------------------------------

/**
 * SPO pillar weights (must sum to 1.0).
 * Same structure as DRep but with SPO-specific pillar names.
 */
export const SPO_PILLAR_WEIGHTS = {
  participation: 0.35,
  deliberation: 0.25,
  reliability: 0.25,
  governanceIdentity: 0.15,
} as const;

// ---------------------------------------------------------------------------
// DRep Confidence System
// ---------------------------------------------------------------------------

/**
 * DRep Confidence computation parameters.
 *
 * Uses graduated thresholds: DReps with very few votes have their tier
 * capped to prevent low-data entities from ranking in Gold/Diamond.
 * The confidence value also dampens percentile scores toward the median,
 * so 0-vote DReps score ~50th percentile instead of being inflated by
 * skewed raw score distributions.
 *
 * Graduated tier caps:
 * - 0-4 votes: 50% confidence, capped at Emerging
 * - 5-9 votes: 75% confidence, capped at Bronze
 * - 10-14 votes: 90% confidence, capped at Silver
 * - 15+ votes: 100% confidence, no cap
 */
export const DREP_CONFIDENCE = {
  /** Vote count decay: 80% at ~15 votes (same as SPO). */
  voteDecayRate: 12,
  /** Epoch span decay: 80% at ~20 epochs. */
  spanDecayRate: 20,
  /** Type coverage threshold: 100% at 60% coverage. */
  typeCoverageThreshold: 0.6,
  /** Factor weights (must sum to 1.0). */
  weights: { vote: 0.5, span: 0.3, type: 0.2 },
  /**
   * Graduated tier caps based on vote count.
   * Each entry: [maxVotes (exclusive), confidence, maxTierName].
   * The last entry (15+) has no cap.
   */
  tierCaps: [
    { maxVotes: 5, confidence: 50, maxTier: 'Emerging' as const },
    { maxVotes: 10, confidence: 75, maxTier: 'Bronze' as const },
    { maxVotes: 15, confidence: 90, maxTier: 'Silver' as const },
  ],
  /** Votes required for full confidence (no cap). */
  fullConfidenceVotes: 15,
  /** Full confidence value. */
  fullConfidence: 100,
} as const;

/**
 * SPO Confidence computation parameters.
 */
export const SPO_CONFIDENCE = {
  /** Vote count decay: 80% at ~15 votes. */
  voteDecayRate: 12,
  /** Epoch span decay: 80% at ~20 epochs. */
  spanDecayRate: 20,
  /** Type coverage threshold: 100% at 60% coverage. */
  typeCoverageThreshold: 0.6,
  /** Factor weights (must sum to 1.0). */
  weights: { vote: 0.5, span: 0.3, type: 0.2 },
  /** Minimum confidence for tier above Emerging. */
  tierThreshold: 60,
} as const;

/**
 * SPO close-margin multiplier at proposal level.
 */
export const SPO_MARGIN = {
  threshold: 0.2,
  multiplier: 1.5,
} as const;

/**
 * SPO Reliability sub-component weights.
 */
export const SPO_RELIABILITY_WEIGHTS = {
  activeStreak: 0.3,
  recency: 0.25,
  gap: 0.15,
  engagementConsistency: 0.15,
  tenure: 0.15,
} as const;

/**
 * SPO Reliability scoring parameters.
 */
export const SPO_RELIABILITY_PARAMS = {
  streakPointsPerEpoch: 15,
  recencyDecayDivisor: 5,
  gapPenaltyPerEpoch: 15,
  tenureFloor: 20,
  tenureGrowth: 80,
  tenureDecayEpochs: 30,
  /** Minimum active epochs for consistency calculation. */
  consistencyMinEpochs: 3,
} as const;

// ---------------------------------------------------------------------------
// Vote Change Bonus
// ---------------------------------------------------------------------------

/**
 * Vote change with explanation bonus.
 * When a DRep changes their vote on a proposal (detected via multiple vote_tx_hash
 * entries for the same drep_id + proposal) AND provides a quality rationale on the
 * new vote (≥ qualityThreshold), the rationale quality contribution for that vote
 * gets a multiplier bonus. This rewards adaptive governance — reconsidering based
 * on new information and explaining why.
 */
export const VOTE_CHANGE_BONUS = {
  /** Minimum rationale quality score on the changed vote to qualify for the bonus. */
  qualityThreshold: 50,
  /** Multiplier applied to rationale quality for qualified vote changes. */
  multiplier: 1.1,
} as const;

// ---------------------------------------------------------------------------
// Temporal Decay — Shared
// ---------------------------------------------------------------------------

/**
 * Temporal decay: half-life of 180 days (~6 months).
 * Rationale: Governance behavior older than 6 months is half as relevant.
 * This balances recency with track record recognition.
 */
export const TEMPORAL_DECAY = {
  halfLifeDays: 180,
  lambda: Math.LN2 / 180,
} as const;

// ---------------------------------------------------------------------------
// Tier Boundaries
// ---------------------------------------------------------------------------

/**
 * Score tier boundaries.
 * Rationale: Modeled after competitive ranking systems.
 * Emerging (0-39): New or inactive. Bronze (40-54): Basic participation.
 * Silver (55-69): Consistent. Gold (70-84): Strong. Diamond (85-94): Elite.
 * Legendary (95-100): Exceptional — by definition, very few DReps.
 */
export const TIER_BOUNDARIES = [
  { name: 'Emerging', min: 0, max: 39 },
  { name: 'Bronze', min: 40, max: 54 },
  { name: 'Silver', min: 55, max: 69 },
  { name: 'Gold', min: 70, max: 84 },
  { name: 'Diamond', min: 85, max: 94 },
  { name: 'Legendary', min: 95, max: 100 },
] as const;

// ---------------------------------------------------------------------------
// DRep & SPO Pillar Calibration Curves (Absolute Scoring)
// ---------------------------------------------------------------------------

/**
 * Absolute calibration curves for DRep pillar scores.
 * Replaces percentile normalization: raw score → calibrated score via
 * piecewise linear mapping. Your actions = your score, independent of
 * how other DReps perform. Uses the same CalibrationCurve shape as GHI.
 *
 * This enables measuring growth in average DRep scores over time as a
 * measure of Governada's impact on Cardano governance health.
 */
export const DREP_PILLAR_CALIBRATION = {
  engagementQuality: {
    floor: 5,
    targetLow: 25,
    targetHigh: 60,
    ceiling: 85,
  },
  effectiveParticipation: {
    floor: 10,
    targetLow: 30,
    targetHigh: 65,
    ceiling: 90,
  },
  reliability: {
    floor: 10,
    targetLow: 30,
    targetHigh: 65,
    ceiling: 85,
  },
  governanceIdentity: {
    floor: 10,
    targetLow: 30,
    targetHigh: 60,
    ceiling: 80,
  },
} as const;

/**
 * Absolute calibration curves for SPO pillar scores.
 */
export const SPO_PILLAR_CALIBRATION = {
  participation: {
    floor: 10,
    targetLow: 30,
    targetHigh: 65,
    ceiling: 90,
  },
  deliberation: {
    floor: 5,
    targetLow: 20,
    targetHigh: 55,
    ceiling: 80,
  },
  reliability: {
    floor: 10,
    targetLow: 30,
    targetHigh: 65,
    ceiling: 85,
  },
  governanceIdentity: {
    floor: 10,
    targetLow: 30,
    targetHigh: 60,
    ceiling: 80,
  },
} as const;

// ---------------------------------------------------------------------------
// DRep Community Presence — Absolute Delegator Tiers
// ---------------------------------------------------------------------------

/**
 * Absolute delegator count tiers for Community Presence scoring.
 * V3.2: Used as FALLBACK when delegation snapshot history is unavailable.
 * Tiers are evaluated highest-first; first match wins.
 */
export const DELEGATOR_TIERS = [
  { min: 250, score: 100 },
  { min: 100, score: 95 },
  { min: 50, score: 80 },
  { min: 15, score: 60 },
  { min: 5, score: 40 },
  { min: 1, score: 20 },
  { min: 0, score: 0 },
] as const;

/**
 * V3.2 Delegation Health configuration.
 * Replaces simple delegator count tiers with three health signals
 * when snapshot history is available.
 */
export const DELEGATION_HEALTH = {
  /** Sub-signal weights (must sum to 1.0). */
  weights: {
    retention: 0.33,
    diversity: 0.33,
    organicGrowth: 0.34,
  },
  /** Minimum number of epoch snapshots required to use health signals. */
  minSnapshotsForHealth: 2,
  /** Number of epochs to average for organic growth rate. */
  growthWindowEpochs: 5,
  /** Organic growth scoring curve: new delegators per epoch → score. */
  growthCurve: [
    { minGrowth: 10, score: 100 },
    { minGrowth: 5, score: 85 },
    { minGrowth: 2, score: 70 },
    { minGrowth: 1, score: 55 },
    { minGrowth: 0, score: 40 },
  ],
  /** Fallback diversity score when ADA amounts unavailable: min(100, count * 2). */
  diversityFallbackMultiplier: 2,
  /** Neutral score for growth when <2 snapshots available. */
  neutralGrowthScore: 50,
} as const;

/**
 * V3.2 Profile Staleness decay configuration.
 * Applies temporal decay to profile quality score based on
 * how recently the profile was updated on-chain.
 */
export const PROFILE_STALENESS = {
  /** Days before decay starts. */
  freshDays: 180,
  /** Days at which decay reaches the floor. */
  staleDays: 360,
  /** Minimum staleness factor (never fully penalize). */
  floor: 0.5,
} as const;

// ---------------------------------------------------------------------------
// CC Constitutional Fidelity Score
// ---------------------------------------------------------------------------

/**
 * CC Constitutional Fidelity — 4-pillar model with zero overlap between pillars.
 *
 * Each pillar measures an independent signal:
 *   1. Participation (25%)             — Do they vote? (on-chain, tenure-scoped)
 *   2. Rationale Provision (20%)       — Do they explain their votes? (CIP-136 presence)
 *   3. Reasoning Quality (40%)         — AI-assessed deliberation substance (primary differentiator)
 *   4. Constitutional Engagement (15%) — Breadth + depth of constitutional article references
 *
 * Weight justification:
 * - Reasoning Quality at 40%: hardest to game, most meaningful — measures actual argument substance
 * - Participation at 25%: necessary baseline but voting alone doesn't prove quality
 * - Rationale Provision at 20%: independent binary signal — did they explain at all?
 * - Constitutional Engagement at 15%: lowest weight, most format-dependent — credits ANY citation
 *
 * Philosophy: "Do they fulfill their constitutional guardian role with substance?
 * This scores PROCESS (did they show up, explain, reason well, engage the constitution)
 * — never OUTCOME (whether their vote was 'right')."
 */
export const CC_FIDELITY_WEIGHTS = {
  participation: 0.25,
  rationaleProvision: 0.2,
  reasoningQuality: 0.4,
  constitutionalEngagement: 0.15,
} as const;

/** Parameters for the Constitutional Engagement pillar. */
export const CC_ENGAGEMENT_PARAMS = {
  /** Number of distinct constitutional articles (Articles I-X). */
  totalConstitutionalArticles: 10,
  /** Target average articles per rationale for a perfect depth score. */
  targetArticlesPerRationale: 3,
  /** Breadth (unique articles cited across career) weight within the pillar. */
  breadthWeight: 0.6,
  /** Depth (avg articles per rationale) weight within the pillar. */
  depthWeight: 0.4,
} as const;

/** Grade thresholds — calibrated from real AI score distribution. */
export const CC_GRADE_THRESHOLDS = {
  A: 80,
  B: 65,
  C: 50,
  D: 35,
} as const;

/** Boilerplate detection penalty applied to Reasoning Quality. */
export const CC_BOILERPLATE_PENALTY = {
  /** Maximum penalty factor (0.5 = halve the score for 100% boilerplate). */
  maxPenaltyFactor: 0.5,
  /** Per-point decay rate: penalty = boilerplate_score * decayRate. */
  decayRate: 0.005,
} as const;

// ---------------------------------------------------------------------------
// GHI Calibration Curves
// ---------------------------------------------------------------------------

/**
 * GHI calibration curves — map raw metric values to 0-100 scores
 * using piecewise linear interpolation.
 *
 * Each curve defines 4 breakpoints:
 * - floor: Below this, score is 0-20 (critical)
 * - targetLow: Floor→targetLow maps to 20-50 (fair)
 * - targetHigh: targetLow→targetHigh maps to 50-80 (good)
 * - ceiling: targetHigh→ceiling maps to 80-95 (strong). Above = cap at 95.
 */
export const GHI_CALIBRATION = {
  drepParticipation: {
    floor: 20,
    targetLow: 40,
    targetHigh: 70,
    ceiling: 90,
  },
  spoParticipation: {
    floor: 10,
    targetLow: 25,
    targetHigh: 55,
    ceiling: 80,
  },
  citizenEngagement: {
    floor: 10,
    targetLow: 30,
    targetHigh: 60,
    ceiling: 80,
  },
  deliberationQuality: {
    floor: 15,
    targetLow: 35,
    targetHigh: 65,
    ceiling: 85,
  },
  governanceEffectiveness: {
    floor: 20,
    targetLow: 40,
    targetHigh: 70,
    ceiling: 90,
  },
  ccConstitutionalFidelity: {
    floor: 15,
    targetLow: 35,
    targetHigh: 65,
    ceiling: 85,
  },
  powerDistribution: {
    floor: 15,
    targetLow: 35,
    targetHigh: 65,
    ceiling: 85,
  },
  systemStability: {
    floor: 30,
    targetLow: 50,
    targetHigh: 75,
    ceiling: 90,
  },
  treasuryHealth: {
    floor: 20,
    targetLow: 40,
    targetHigh: 70,
    ceiling: 90,
  },
} as const;

// ---------------------------------------------------------------------------
// GHI Component Weights
// ---------------------------------------------------------------------------

/**
 * GHI component weights (must sum to 1.0).
 *
 * Engagement (32%): DRep Participation (14%) + SPO Participation (9%) + Citizen Engagement (9%)
 * Quality (37%): Deliberation Quality (14%) + Governance Effectiveness (14%) + CC Constitutional Fidelity (9%)
 * Resilience (23%): Power Distribution (14%) + System Stability (9%)
 * Sustainability (8%): Treasury Health (8%)
 */
export const GHI_COMPONENT_WEIGHTS = {
  'DRep Participation': 0.14,
  'SPO Participation': 0.09,
  'Citizen Engagement': 0.09,
  'Deliberation Quality': 0.14,
  'Governance Effectiveness': 0.14,
  'CC Constitutional Fidelity': 0.09,
  'Power Distribution': 0.14,
  'System Stability': 0.09,
  'Treasury Health': 0.08,
} as const;

/**
 * GHI band boundaries.
 */
export const GHI_BANDS = {
  strong: 76,
  good: 51,
  fair: 26,
  // Below fair = critical
} as const;

// ---------------------------------------------------------------------------
// EDI Metric Weights
// ---------------------------------------------------------------------------

/**
 * Edinburgh Decentralization Index metric weights (must sum to 1.0).
 */
export const EDI_METRIC_WEIGHTS = {
  nakamoto: 0.2,
  gini: 0.15,
  shannonEntropy: 0.2,
  hhi: 0.15,
  theil: 0.1,
  concentration: 0.1,
  tau: 0.1,
} as const;

// ---------------------------------------------------------------------------
// Alignment Dimension Weights (for drift detection)
// ---------------------------------------------------------------------------

/**
 * Per-dimension weights for alignment drift scoring.
 * Treasury dimensions weighted highest (most governance-material).
 */
export const ALIGNMENT_DRIFT_WEIGHTS = {
  treasuryConservative: 0.2,
  treasuryGrowth: 0.2,
  decentralization: 0.2,
  security: 0.15,
  innovation: 0.15,
  transparency: 0.1,
} as const;

/**
 * Drift classification thresholds.
 */
export const DRIFT_THRESHOLDS = {
  low: 15,
  moderate: 30,
  // Above moderate = high
} as const;

// ---------------------------------------------------------------------------
// Embedding-Enhanced Deliberation Weights
// ---------------------------------------------------------------------------

/**
 * Enhanced GHI deliberation quality weights when `embedding_ghi_deliberation` flag is ON.
 * Adds semantic diversity and reasoning coherence sub-signals.
 * Must sum to 1.0.
 *
 * Compared to base weights (rationale 0.5, debate 0.3, independence 0.2):
 * - Rationale quality reduced from 0.5 → 0.35 (still dominant)
 * - Debate diversity reduced from 0.3 → 0.2
 * - Voting independence reduced from 0.2 → 0.15
 * - Semantic diversity added at 0.2 (embedding-based argument spread)
 * - Reasoning coherence added at 0.1 (rationale-proposal relevance)
 */
export const EMBEDDING_DELIBERATION_WEIGHTS = {
  rationaleQuality: 0.35,
  debateDiversity: 0.2,
  votingIndependence: 0.15,
  semanticDiversity: 0.2,
  reasoningCoherence: 0.1,
} as const;

// ---------------------------------------------------------------------------
// Piecewise Linear Calibration Function
// ---------------------------------------------------------------------------

/**
 * Calibration curve shape for piecewise linear mapping.
 */
export interface CalibrationCurve {
  floor: number;
  targetLow: number;
  targetHigh: number;
  ceiling: number;
}

/**
 * Piecewise linear calibration: maps a raw 0-100 score to a calibrated 0-95 score.
 * Used by both GHI components and individual pillar scoring (DRep/SPO).
 *
 * Below floor    → 0-20  (critical)
 * Floor→targetLow  → 20-50 (fair)
 * TargetLow→targetHigh → 50-80 (good)
 * TargetHigh→ceiling  → 80-95 (strong)
 * Above ceiling   → cap at 95
 */
export function calibrate(raw: number, curve: CalibrationCurve): number {
  if (raw <= curve.floor) {
    return curve.floor === 0 ? 0 : Math.max(0, (raw / curve.floor) * 20);
  }
  if (raw <= curve.targetLow) {
    return 20 + ((raw - curve.floor) / (curve.targetLow - curve.floor)) * 30;
  }
  if (raw <= curve.targetHigh) {
    return 50 + ((raw - curve.targetLow) / (curve.targetHigh - curve.targetLow)) * 30;
  }
  if (raw <= curve.ceiling) {
    return 80 + ((raw - curve.targetHigh) / (curve.ceiling - curve.targetHigh)) * 15;
  }
  return 95;
}

// ---------------------------------------------------------------------------
// PCA Configuration
// ---------------------------------------------------------------------------

/**
 * PCA explained variance enforcement.
 * If 6 components explain less than this threshold, fall back to manual dimensions.
 */
export const PCA_CONFIG = {
  /** Minimum total explained variance (0-1) for PCA results to be trusted. */
  minExplainedVariance: 0.6,
  /** Default number of PCA components to extract. */
  defaultComponents: 6,
} as const;
