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

export function computeTier(score: number): TierName {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (clamped >= TIERS[i].min) return TIERS[i].name;
  }
  return 'Emerging';
}

export function getTierInfo(tierName: TierName): TierInfo {
  const tier = TIERS.find((t) => t.name === tierName);
  if (!tier) return { name: 'Emerging', min: 0, max: 39 };
  return { name: tier.name, min: tier.min, max: tier.max };
}

export function computeTierProgress(score: number): TierProgress {
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
