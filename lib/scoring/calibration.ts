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
 * Rationale: Engagement Quality (35%) is weighted highest because rationale
 * provision and quality are the strongest signals of governance diligence.
 * Participation and Reliability (25% each) reward showing up consistently.
 * Identity (15%) is the baseline — important but not dominant.
 */
export const DREP_PILLAR_WEIGHTS = {
  engagementQuality: 0.35,
  effectiveParticipation: 0.25,
  reliability: 0.25,
  governanceIdentity: 0.15,
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
 */
export const DELIBERATION_WEIGHTS = {
  voteDiversity: 0.4,
  dissent: 0.35,
  typeBreadth: 0.25,
} as const;

/**
 * Vote diversity thresholds — penalizes rubber-stamping.
 * Maps dominant vote ratio → score.
 * >95% same direction = 15 (severe penalty), >90% = 35, etc.
 */
export const VOTE_DIVERSITY_THRESHOLDS = [
  { maxRatio: 0.75, score: 100 },
  { maxRatio: 0.85, score: 75 },
  { maxRatio: 0.9, score: 55 },
  { maxRatio: 0.95, score: 35 },
  { maxRatio: 1.0, score: 15 },
] as const;

/** Minimum votes needed to evaluate diversity (below this → neutral 50). */
export const VOTE_DIVERSITY_MIN_VOTES = 5;

/**
 * Dissent scoring curve breakpoints.
 * Sweet spot: 15-40% dissent = maximum score (independent thinking).
 * 0% = rubber-stamper (25), >40% = contrarian (decays to 15).
 */
export const DISSENT_CURVE = {
  zeroRate: 25,
  sweetSpotStart: 0.15,
  sweetSpotEnd: 0.4,
  sweetSpotScore: 100,
  minScore: 15,
  /** Minimum eligible votes to evaluate dissent. */
  minVotes: 5,
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
 */
export const RELIABILITY_WEIGHTS = {
  streak: 0.3,
  recency: 0.25,
  gap: 0.2,
  responsiveness: 0.15,
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
  /** Responsiveness: score = 100 * exp(-medianDays / divisor). */
  responsivenessDivisor: 14,
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
} as const;

// ---------------------------------------------------------------------------
// GHI Component Weights
// ---------------------------------------------------------------------------

/**
 * GHI component weights (must sum to 1.0).
 *
 * Engagement (35%): DRep Participation (20%) + Citizen Engagement (15%)
 * Quality (40%): Deliberation Quality (20%) + Governance Effectiveness (20%)
 * Resilience (25%): Power Distribution (15%) + System Stability (10%)
 */
export const GHI_COMPONENT_WEIGHTS = {
  'DRep Participation': 0.2,
  'Citizen Engagement': 0.15,
  'Deliberation Quality': 0.2,
  'Governance Effectiveness': 0.2,
  'Power Distribution': 0.15,
  'System Stability': 0.1,
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
