/**
 * Score Tier System — Emerging → Bronze → Silver → Gold → Diamond → Legendary.
 * Applied to both DRep and SPO scores. Tiers create emotional weight,
 * competitive pressure, and shareability (ADR-005, ADR-006).
 */

export const TIERS = [
  { name: 'Emerging', min: 0, max: 39 },
  { name: 'Bronze', min: 40, max: 54 },
  { name: 'Silver', min: 55, max: 69 },
  { name: 'Gold', min: 70, max: 84 },
  { name: 'Diamond', min: 85, max: 94 },
  { name: 'Legendary', min: 95, max: 100 },
] as const;

export type TierName = (typeof TIERS)[number]['name'];

export interface TierInfo {
  name: TierName;
  min: number;
  max: number;
}

export interface TierProgress {
  currentTier: TierName;
  score: number;
  pointsToNext: number | null;
  percentWithinTier: number;
  nextTier: TierName | null;
  /** Human-readable action that would most improve this entity's score. */
  recommendedAction: string | null;
}

/** Pillar scores used to determine the most impactful recommended action. */
export interface PillarBreakdown {
  engagementQuality?: number | null;
  effectiveParticipation?: number | null;
  reliability?: number | null;
  governanceIdentity?: number | null;
  // SPO V3 pillars
  participation?: number | null;
  deliberation?: number | null;
}

export interface TierChange {
  entityType: 'drep' | 'spo';
  entityId: string;
  oldTier: TierName;
  newTier: TierName;
  oldScore: number;
  newScore: number;
  direction: 'up' | 'down';
}

/**
 * Compute tier from score, optionally gated by confidence.
 * If confidence < CONFIDENCE_TIER_THRESHOLD, caps tier at Emerging (SPO behavior).
 * For DReps, use computeTierWithCap() which supports graduated caps.
 */
export function computeTier(score: number, confidence?: number): TierName {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  // Confidence gate: low-confidence entities max out at Emerging
  if (confidence !== undefined && confidence < 60) {
    return 'Emerging';
  }

  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (clamped >= TIERS[i].min) return TIERS[i].name;
  }
  return 'Emerging';
}

/**
 * Compute tier with graduated cap support.
 * Used for DReps where the tier cap depends on vote count.
 * If maxTier is provided, the computed tier cannot exceed it.
 *
 * @param score Composite score (0-100)
 * @param maxTier Maximum allowed tier (null = no cap)
 */
export function computeTierWithCap(score: number, maxTier: TierName | null): TierName {
  const baseTier = computeTier(score);

  if (maxTier === null) return baseTier;

  const baseIdx = tierIndex(baseTier);
  const capIdx = tierIndex(maxTier);

  // If the base tier exceeds the cap, return the cap tier instead
  if (baseIdx > capIdx) return maxTier;

  return baseTier;
}

export function getTierInfo(tierName: TierName): TierInfo {
  const tier = TIERS.find((t) => t.name === tierName);
  if (!tier) return { name: 'Emerging', min: 0, max: 39 };
  return { name: tier.name, min: tier.min, max: tier.max };
}

/**
 * Determine which action would most improve the entity's score based on
 * which pillar has the most room for improvement (lowest relative score).
 */
function deriveRecommendedAction(pillars?: PillarBreakdown): string | null {
  if (!pillars) return null;

  const entries: [string, number][] = [];

  // SPO V3 pillars take precedence if present
  if (pillars.participation !== undefined && pillars.participation !== null) {
    entries.push(
      ['participation', (pillars.participation ?? 50) * 0.35],
      ['deliberation', (pillars.deliberation ?? 50) * 0.25],
      ['reliability', (pillars.reliability ?? 50) * 0.25],
      ['governanceIdentity', (pillars.governanceIdentity ?? 50) * 0.15],
    );
  } else {
    // DRep pillars
    entries.push(
      ['engagementQuality', (pillars.engagementQuality ?? 50) * 0.35],
      ['effectiveParticipation', (pillars.effectiveParticipation ?? 50) * 0.3],
      ['reliability', (pillars.reliability ?? 50) * 0.2],
      ['governanceIdentity', (pillars.governanceIdentity ?? 50) * 0.15],
    );
  }

  // Find the pillar with the lowest weighted score (most room to grow)
  const [weakest] = entries.sort((a, b) => a[1] - b[1]);
  if (!weakest) return null;

  const actions: Record<string, string> = {
    engagementQuality: 'Submit rationales for your next votes to improve Engagement Quality',
    effectiveParticipation: 'Vote on open governance proposals to improve Effective Participation',
    participation: 'Vote on open governance proposals to improve Participation',
    deliberation:
      'Provide vote rationales and diversify proposal types to improve Deliberation Quality',
    reliability: 'Maintain a consistent voting streak to improve Reliability',
    governanceIdentity:
      'Complete your governance profile and social links to improve Governance Identity',
  };

  return actions[weakest[0]] ?? null;
}

export function computeTierProgress(score: number, pillars?: PillarBreakdown): TierProgress {
  const currentTier = computeTier(score);
  const currentTierInfo = getTierInfo(currentTier);
  const currentIdx = TIERS.findIndex((t) => t.name === currentTier);
  const nextTierInfo = currentIdx < TIERS.length - 1 ? TIERS[currentIdx + 1] : null;

  const tierRange = currentTierInfo.max - currentTierInfo.min + 1;
  const positionInTier = Math.round(score) - currentTierInfo.min;
  const percentWithinTier = Math.round((positionInTier / tierRange) * 100);

  return {
    currentTier,
    score: Math.round(score),
    pointsToNext: nextTierInfo ? nextTierInfo.min - Math.round(score) : null,
    percentWithinTier: Math.max(0, Math.min(100, percentWithinTier)),
    nextTier: nextTierInfo?.name ?? null,
    recommendedAction: deriveRecommendedAction(pillars),
  };
}

export function detectTierChange(
  entityType: 'drep' | 'spo',
  entityId: string,
  oldScore: number,
  newScore: number,
): TierChange | null {
  const oldTier = computeTier(oldScore);
  const newTier = computeTier(newScore);

  if (oldTier === newTier) return null;

  const oldIdx = TIERS.findIndex((t) => t.name === oldTier);
  const newIdx = TIERS.findIndex((t) => t.name === newTier);

  return {
    entityType,
    entityId,
    oldTier,
    newTier,
    oldScore: Math.round(oldScore),
    newScore: Math.round(newScore),
    direction: newIdx > oldIdx ? 'up' : 'down',
  };
}

export function tierIndex(tierName: TierName): number {
  return TIERS.findIndex((t) => t.name === tierName);
}
