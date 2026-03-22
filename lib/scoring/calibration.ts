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
 *
 * V3.2: Graduated tier caps matching DRep architecture.
 * Replaces the binary tierThreshold with vote-count-based caps.
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
  /** Graduated tier caps matching DRep architecture. */
  tierCaps: [
    { maxVotes: 5, confidence: 50, maxTier: 'Emerging' as const },
    { maxVotes: 10, confidence: 75, maxTier: 'Bronze' as const },
    { maxVotes: 15, confidence: 90, maxTier: 'Silver' as const },
  ],
  fullConfidenceVotes: 15,
  fullConfidence: 100,
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

/**
 * SPO Deliberation Quality sub-component weights.
 * V3.2: Replaces broken rationale-based scoring with voting behavior signals.
 */
export const SPO_DELIBERATION_WEIGHTS = {
  voteDiversity: 0.35,
  dissent: 0.3,
  typeBreadth: 0.2,
  coverageEntropy: 0.15,
} as const;

/**
 * SPO abstain penalty for vote diversity.
 * SPOs with >60% abstain rate get penalized — abstaining on everything
 * is not meaningful governance participation.
 */
export const SPO_ABSTAIN_PENALTY = {
  /** Abstain rate above this threshold triggers penalty */
  threshold: 0.6,
  /** Minimum factor (floor) to prevent total zeroing */
  minFactor: 0.3,
} as const;

/**
 * Sybil Confidence Penalty — reduces confidence (not raw score) for pools
 * with unresolved sybil flags. Graduated by severity.
 */
export const SYBIL_CONFIDENCE_PENALTY = {
  /** Standard penalty for single unresolved sybil flag */
  standard: 25,
  /** High-confidence sybil (>98% agreement) */
  highConfidence: 40,
  /** Multiple distinct sybil partners flagged */
  multiPartner: 50,
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
 * Calibration version metadata — tracks when curves were last justified
 * and what methodology was used.
 */
export const CALIBRATION_VERSION = {
  version: '3.2.0',
  lastCalibrated: '2026-03-22',
  methodology:
    'Behavioral threshold analysis — each breakpoint maps to specific governance behaviors. See comments on DREP_PILLAR_CALIBRATION and SPO_PILLAR_CALIBRATION.',
} as const;

/**
 * Absolute calibration curves for DRep pillar scores.
 * Replaces percentile normalization: raw score → calibrated score via
 * piecewise linear mapping. Your actions = your score, independent of
 * how other DReps perform. Uses the same CalibrationCurve shape as GHI.
 *
 * This enables measuring growth in average DRep scores over time as a
 * measure of Governada's impact on Cardano governance health.
 *
 * Each breakpoint is justified by the behavioral thresholds derived from
 * the scoring functions. The calibrate() function maps:
 *   Below floor    → 0-20  (Critical / Emerging tier)
 *   Floor→targetLow  → 20-50 (Fair / Bronze-range)
 *   TargetLow→targetHigh → 50-80 (Good / Silver-Gold range)
 *   TargetHigh→ceiling  → 80-95 (Strong / Diamond range)
 *   Above ceiling   → capped at 95
 */
export const DREP_PILLAR_CALIBRATION = {
  /**
   * Engagement Quality (40% of composite).
   * Three layers: Provision Rate (40%), Rationale Quality (40%), Deliberation (20%).
   *
   * Raw score composition at behavioral milestones:
   * - raw ≈ 0: No votes or no rationales at all → score 0.
   * - raw ≈ 8: Votes on a few proposals, provides rationale ~20% of the time,
   *   rationale quality avg ~20/100, neutral deliberation (50 from < 3 rationales).
   *   Provision: 20×0.4=8, Quality: 20×0.4=8, Deliberation: 50×0.2=10 → ~26 raw.
   *   Actually this is higher — floor should catch truly minimal engagement.
   *   floor=8 catches: voted 1-2 times, 1 low-quality rationale.
   *   Provision ~10%, Quality ~10, Delib neutral → 10×0.4 + 10×0.4 + 50×0.2 = 18.
   *   floor=8 means even that maps to calibrated ~20 (fair entry).
   *
   * - floor (8): DRep voted once or twice total, provided 1 rationale of minimal
   *   quality. Provision ~5-10%, quality ~5-10, deliberation neutral (50).
   *   Raw ≈ 5×0.4 + 5×0.4 + 50×0.2 = 14 — but with decay, recent single vote
   *   could yield ~8. Calibrated: 20 (entering "fair" zone).
   *
   * - targetLow (28): Votes on ~30% of proposals, provides rationales ~40% of the
   *   time, avg quality ~35/100, moderate diversity.
   *   Provision: 40×0.4=16, Quality: 35×0.4=14, Deliberation: ~45×0.2=9 → ~39 raw.
   *   With decay pulling older votes down, active DRep at this level ≈ 28.
   *   Calibrated: 50 (midpoint, solidly "fair" → entering "good").
   *
   * - targetHigh (58): Votes on 60%+ of proposals, provides rationales ~75% of the
   *   time, avg quality ~60/100, good diversity (unique rationales, covers most
   *   proposal types). Some dissent-with-substance bonuses.
   *   Provision: 75×0.4=30, Quality: 60×0.4=24, Deliberation: ~70×0.2=14 → ~68 raw.
   *   Temporal decay moderates to ~58 for sustained behavior.
   *   Calibrated: 80 (entering "strong" zone).
   *
   * - ceiling (82): Votes on 90%+ of proposals, provides rationales ~95% of the time,
   *   avg quality ~80/100, excellent diversity, dissent bonuses on minority votes.
   *   Provision: 95×0.4=38, Quality: 80×0.4=32, Deliberation: ~85×0.2=17 → ~87 raw.
   *   With decay: ~82. Calibrated: 95 (cap — near-perfect engagement).
   */
  engagementQuality: {
    floor: 8,
    targetLow: 28,
    targetHigh: 58,
    ceiling: 82,
  },

  /**
   * Effective Participation (25% of composite).
   * Importance-weighted vote coverage: (weighted votes / weighted proposal pool) × 100.
   * Close-margin proposals get 1.5× weight. Critical types get 3×, important get 2×.
   *
   * - raw = 0: Never voted.
   * - floor (12): Voted on ~10-15% of proposals by weight. A DRep who voted on a
   *   handful of standard proposals out of ~50+ total. With temporal decay, recent
   *   sporadic voting yields raw ~12.
   *   Calibrated: 20 (entering "fair").
   *
   * - targetLow (32): Voted on ~30-35% of proposals by weight. A DRep who votes on
   *   roughly a third of governance actions, including some important ones.
   *   With close-margin bonuses on contentious votes, could reach ~32 with 25%
   *   raw coverage if several were close-margin.
   *   Calibrated: 50 (midpoint).
   *
   * - targetHigh (65): Voted on ~60-70% of proposals by weight. A DRep who votes on
   *   most proposals, including critical types (HardFork, NoConfidence) and
   *   significant treasury withdrawals. Close-margin bonuses push this higher.
   *   Calibrated: 80 (entering "strong").
   *
   * - ceiling (88): Voted on 85%+ of proposals by weight, including all critical
   *   and important types. Close-margin bonuses on contentious proposals push
   *   effective coverage near 88. Near-perfect participation.
   *   Calibrated: 95 (cap).
   */
  effectiveParticipation: {
    floor: 12,
    targetLow: 32,
    targetHigh: 65,
    ceiling: 88,
  },

  /**
   * Reliability (25% of composite).
   * Four sub-components: Streak (35%), Recency (30%), Gap (25%), Tenure (10%).
   *
   * Sub-component raw score ranges:
   * - Streak: 10 pts/epoch, so 3-epoch streak = 30, 5 = 50, 10 = 100.
   * - Recency: exp decay with divisor 5. 0 epochs ago = 100, 2 = 67, 5 = 37, 10 = 14.
   * - Gap: 100 - 12×longestGap. 0 gap = 100, 3 = 64, 5 = 40, 8+ = 4.
   * - Tenure: 20 + 80×(1 - e^(-tenure/30)). 0 epochs = 20, 10 = 44, 30 = 69, 60 = 87.
   *
   * - floor (12): DRep voted once long ago. Streak 0 (10×0=0), Recency ~14 (10 epochs
   *   ago), Gap ~40 (5 proposal-epochs missed), Tenure ~44 (10 epochs).
   *   Combined: 0×0.35 + 14×0.30 + 40×0.25 + 44×0.10 = 0+4.2+10+4.4 = ~19.
   *   With even worse scenarios (longer gap, older): ~12.
   *   Calibrated: 20 (entering "fair").
   *
   * - targetLow (35): DRep votes semi-regularly. Streak of 2 (20), Recency ~67
   *   (2 epochs ago), Gap ~64 (3-epoch gap), Tenure ~44 (10 epochs).
   *   Combined: 20×0.35 + 67×0.30 + 64×0.25 + 44×0.10 = 7+20+16+4.4 = ~47.
   *   But with some misses pulling streak/recency down: ~35.
   *   Calibrated: 50 (midpoint).
   *
   * - targetHigh (68): DRep votes consistently. Streak of 5 (50), Recency 100
   *   (voted this epoch), Gap ~76 (2-epoch gap once), Tenure ~69 (30 epochs).
   *   Combined: 50×0.35 + 100×0.30 + 76×0.25 + 69×0.10 = 17.5+30+19+6.9 = ~73.
   *   Moderate tenure pulls slightly lower: ~68.
   *   Calibrated: 80 (entering "strong").
   *
   * - ceiling (88): DRep has voted every proposal-epoch for 7+ epochs (streak 70+),
   *   voted this epoch (recency 100), no gaps (100), tenure 60+ epochs (~87).
   *   Combined: 70×0.35 + 100×0.30 + 100×0.25 + 87×0.10 = 24.5+30+25+8.7 = ~88.
   *   Calibrated: 95 (cap — rock-solid reliability).
   */
  reliability: {
    floor: 12,
    targetLow: 35,
    targetHigh: 68,
    ceiling: 88,
  },

  /**
   * Governance Identity (10% of composite).
   * Two sub-components: Profile Quality (60%) and Community Presence (40%).
   *
   * Profile Quality max raw = 100 (name 15, objectives 20, motivations 15,
   * qualifications 10, bio 10, social links 30, hash verified 5 = 105, capped 100).
   * With staleness decay: fresh profile = 1.0×, 270 days = 0.75×, 360+ days = 0.5×.
   *
   * Community Presence: delegation health (retention/diversity/growth) or fallback
   * delegator tiers (250+ = 100, 100+ = 95, 50+ = 80, 15+ = 60, 5+ = 40, 1+ = 20).
   *
   * - floor (15): Minimal profile (name only = 15 pts, nothing else).
   *   Profile: 15×0.6 = 9. Community: 0 delegators = 0×0.4 = 0. Raw ~9.
   *   Or: name + short bio (15+3=18), 1 delegator (20).
   *   Profile: 18×0.6 = 10.8. Community: 20×0.4 = 8. Raw ~19.
   *   floor=15 catches the bare-minimum-profile DRep.
   *   Calibrated: 20 (entering "fair").
   *
   * - targetLow (35): Basic profile with name, short objectives/motivations
   *   (15+15+10=40), one social link (25), 5+ delegators (40).
   *   Profile: 40×0.6 = 24 (if fresh). Community: 40×0.4 = 16. Raw ~40.
   *   With mild staleness (0.9×): profile 36×0.6=21.6 + 16 = ~38.
   *   targetLow=35 reflects "filled out the basics."
   *   Calibrated: 50 (midpoint).
   *
   * - targetHigh (62): Good profile: name (15), long objectives (20), long
   *   motivations (15), qualifications (7), bio (7), 2+ social links (30),
   *   hash verified (5) = 99 → 100. Fresh. 50+ delegators (80).
   *   Profile: 100×0.6 = 60. Community: 80×0.4 = 32. Raw ~92.
   *   But with any staleness or fewer delegators: 15+ delegators (60).
   *   Profile 80×0.6=48, Community 60×0.4=24 → 72.
   *   targetHigh=62 is achievable with a strong (not perfect) profile + moderate community.
   *   Calibrated: 80 (entering "strong").
   *
   * - ceiling (82): Near-perfect profile (100 raw, fresh), 100+ delegators
   *   (score 95) or healthy delegation metrics.
   *   Profile: 100×0.6 = 60. Community: 95×0.4 = 38. Raw ~98.
   *   ceiling=82 accounts for most DReps having some staleness or delegation gaps.
   *   With 6-month-old profile (0.75×): 75×0.6=45 + 95×0.4=38 → 83.
   *   Calibrated: 95 (cap — exemplary governance identity).
   */
  governanceIdentity: {
    floor: 15,
    targetLow: 35,
    targetHigh: 62,
    ceiling: 82,
  },
} as const;

/**
 * Absolute calibration curves for SPO pillar scores.
 *
 * SPO governance participation is structurally lower than DRep participation
 * (block production is primary role, governance is secondary), so curves
 * are slightly more generous — rewarding SPOs who engage at all.
 */
export const SPO_PILLAR_CALIBRATION = {
  /**
   * SPO Participation (35% of composite).
   * Same formula as DRep Effective Participation: importance-weighted vote coverage.
   * SPOs typically vote less than DReps (governance is secondary to block production),
   * so the curve is shifted left to reward any meaningful engagement.
   *
   * - floor (10): SPO voted on ~10% of proposals. A pool operator who cast a few
   *   votes on high-profile proposals only.
   *   Calibrated: 20 (entering "fair").
   *
   * - targetLow (28): SPO voted on ~25-30% of proposals, including some important
   *   ones. Solid engagement for a pool operator.
   *   Calibrated: 50 (midpoint).
   *
   * - targetHigh (60): SPO voted on ~55-65% of proposals including critical types.
   *   This is strong for an SPO — most never reach this level.
   *   Calibrated: 80 (entering "strong").
   *
   * - ceiling (85): SPO voted on 80%+ of proposals. Exceptional for a pool operator.
   *   Calibrated: 95 (cap).
   */
  participation: {
    floor: 10,
    targetLow: 28,
    targetHigh: 60,
    ceiling: 85,
  },

  /**
   * SPO Deliberation Quality (25% of composite).
   * Two sub-components: Rationale Provision (55%) and Coverage Entropy (45%).
   * SPOs rarely provide rationales (no CIP-100 tooling standard for SPOs yet),
   * so the curve is the most generous of all pillars.
   *
   * - floor (6): SPO provided at least 1 rationale or has minimal coverage entropy.
   *   Rationale provision ~5% + coverage entropy with 1 type.
   *   Raw: 5×0.55 + 15×0.45 ≈ 9.5. With low coverage: ~6.
   *   Calibrated: 20 (entering "fair").
   *
   * - targetLow (22): SPO provides rationales ~20% of the time, covers 2-3
   *   proposal types. Raw: 20×0.55 + 40×0.45 = 11+18 = 29. With decay: ~22.
   *   Calibrated: 50 (midpoint — this is already above-average for SPOs).
   *
   * - targetHigh (52): SPO provides rationales ~50% of the time, covers most
   *   proposal types with reasonable entropy.
   *   Raw: 50×0.55 + 60×0.45 = 27.5+27 = 54.5. With decay: ~52.
   *   Calibrated: 80 (entering "strong").
   *
   * - ceiling (78): SPO provides rationales ~80%+ of the time with balanced
   *   coverage entropy across all types. Exceptional deliberation for an SPO.
   *   Raw: 80×0.55 + 80×0.45 = 44+36 = 80. With decay: ~78.
   *   Calibrated: 95 (cap).
   */
  deliberation: {
    floor: 6,
    targetLow: 22,
    targetHigh: 52,
    ceiling: 78,
  },

  /**
   * SPO Reliability (25% of composite).
   * Five sub-components: Active Streak (30%), Recency (25%), Gap (15%),
   * Engagement Consistency (15%), Tenure (15%).
   *
   * SPO reliability params: streak 15 pts/epoch (vs DRep 10), gap penalty 15/epoch
   * (vs DRep 12), same recency/tenure. Consistency is unique to SPOs.
   *
   * - floor (12): SPO voted once some time ago. Low streak, poor recency, some gaps.
   *   Streak 0, Recency ~14 (10 epochs ago), Gap ~40 (4 missed), Consistency 50 (default),
   *   Tenure ~44. Combined: 0×0.3 + 14×0.25 + 40×0.15 + 50×0.15 + 44×0.15 = 0+3.5+6+7.5+6.6=~24.
   *   Worse scenarios: ~12.
   *   Calibrated: 20 (entering "fair").
   *
   * - targetLow (32): SPO votes semi-regularly. Streak of 2 (30), Recency ~67
   *   (2 epochs ago), Gap ~55 (3 missed), Consistency ~60, Tenure ~44.
   *   Combined: 30×0.3 + 67×0.25 + 55×0.15 + 60×0.15 + 44×0.15 = 9+16.75+8.25+9+6.6=~50.
   *   With missed epochs: ~32.
   *   Calibrated: 50 (midpoint).
   *
   * - targetHigh (65): SPO votes consistently. Streak of 4 (60), Recency 100,
   *   Gap ~70 (2-epoch gap), Consistency ~80, Tenure ~69.
   *   Combined: 60×0.3 + 100×0.25 + 70×0.15 + 80×0.15 + 69×0.15 = 18+25+10.5+12+10.35=~76.
   *   Moderate tenure/consistency: ~65.
   *   Calibrated: 80 (entering "strong").
   *
   * - ceiling (86): SPO has voted every proposal-epoch for 6+ epochs (streak 90),
   *   voted this epoch (100), no gaps (100), high consistency (90), good tenure (~87).
   *   Combined: 90×0.3 + 100×0.25 + 100×0.15 + 90×0.15 + 87×0.15 = 27+25+15+13.5+13.05=~94.
   *   ceiling=86 accounts for typical operational gaps.
   *   Calibrated: 95 (cap).
   */
  reliability: {
    floor: 12,
    targetLow: 32,
    targetHigh: 65,
    ceiling: 86,
  },

  /**
   * SPO Governance Identity (15% of composite).
   * Same scoring as DRep Governance Identity: Profile Quality (60%) + Community
   * Presence (40%). SPOs use the same profile field scores and delegation metrics.
   *
   * The curve is identical to DRep GI since the scoring function is shared and
   * SPOs face the same profile/community dynamics.
   *
   * - floor (15): Minimal profile (name only, no delegators).
   * - targetLow (35): Basic profile with name + short objectives + 1 social link, 5+ delegators.
   * - targetHigh (62): Strong profile (most fields filled), 15+ delegators.
   * - ceiling (82): Near-perfect fresh profile, 100+ delegators or healthy delegation.
   */
  governanceIdentity: {
    floor: 15,
    targetLow: 35,
    targetHigh: 62,
    ceiling: 82,
  },
} as const;

// ---------------------------------------------------------------------------
// DRep Community Presence — Absolute Delegator Tiers
// ---------------------------------------------------------------------------

/**
 * Absolute delegator count tiers for Community Presence scoring.
 * Tiers are evaluated highest-first; first match wins.
 * // Note: SPO identity no longer uses delegator tiers as of V3.2. Still used by DRep identity.
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
