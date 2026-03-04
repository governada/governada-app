/**
 * Shared tier-color tokens for Civica card components.
 * Single source of truth — import everywhere.
 */

export type TierKey = 'Emerging' | 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Legendary';

export const TIER_SCORE_COLOR: Record<TierKey, string> = {
  Emerging: 'text-muted-foreground',
  Bronze: 'text-amber-500',
  Silver: 'text-slate-300',
  Gold: 'text-yellow-400',
  Diamond: 'text-cyan-300',
  Legendary: 'text-violet-400',
};

export const TIER_BORDER: Record<TierKey, string> = {
  Emerging: 'border-border',
  Bronze: 'border-amber-800/40',
  Silver: 'border-slate-600/40',
  Gold: 'border-yellow-700/50',
  Diamond: 'border-cyan-700/50',
  Legendary: 'border-violet-700/60',
};

export const TIER_BG: Record<TierKey, string> = {
  Emerging: 'bg-card',
  Bronze: 'bg-amber-950/15',
  Silver: 'bg-slate-900/20',
  Gold: 'bg-yellow-950/15',
  Diamond: 'bg-cyan-950/15',
  Legendary: 'bg-violet-950/20',
};

export const TIER_GLOW: Record<TierKey, string> = {
  Emerging: '',
  Bronze: 'hover:shadow-amber-900/20',
  Silver: 'hover:shadow-slate-700/20',
  Gold: 'hover:shadow-yellow-900/30',
  Diamond: 'hover:shadow-cyan-900/30',
  Legendary: 'hover:shadow-violet-900/40',
};

export const TIER_BADGE_BG: Record<TierKey, string> = {
  Emerging: 'bg-muted text-muted-foreground',
  Bronze: 'bg-amber-950/50 text-amber-400 border border-amber-800/40',
  Silver: 'bg-slate-900/50 text-slate-300 border border-slate-600/40',
  Gold: 'bg-yellow-950/50 text-yellow-400 border border-yellow-800/40',
  Diamond: 'bg-cyan-950/50 text-cyan-300 border border-cyan-700/40',
  Legendary: 'bg-violet-950/60 text-violet-300 border border-violet-700/50',
};

export function tierKey(tier: string | null | undefined): TierKey {
  const valid: TierKey[] = ['Emerging', 'Bronze', 'Silver', 'Gold', 'Diamond', 'Legendary'];
  return valid.includes(tier as TierKey) ? (tier as TierKey) : 'Emerging';
}
