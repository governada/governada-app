/**
 * Shared tier-color tokens for Governada card components.
 * Single source of truth — import everywhere.
 * Each token provides light + dark mode classes.
 */

export type TierKey = 'Emerging' | 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Legendary';

export const TIER_SCORE_COLOR: Record<TierKey, string> = {
  Emerging: 'text-muted-foreground',
  Bronze: 'text-amber-700 dark:text-amber-500',
  Silver: 'text-slate-500 dark:text-slate-300',
  Gold: 'text-yellow-600 dark:text-yellow-400',
  Diamond: 'text-cyan-600 dark:text-cyan-300',
  Legendary: 'text-violet-600 dark:text-violet-400',
};

export const TIER_BORDER: Record<TierKey, string> = {
  Emerging: 'border-border',
  Bronze: 'border-amber-300/60 dark:border-amber-800/40',
  Silver: 'border-slate-300/60 dark:border-slate-600/40',
  Gold: 'border-yellow-300/70 dark:border-yellow-700/50',
  Diamond: 'border-cyan-300/70 dark:border-cyan-700/50',
  Legendary: 'border-violet-300/70 dark:border-violet-700/60',
};

export const TIER_BG: Record<TierKey, string> = {
  Emerging: 'bg-card/70',
  Bronze: 'bg-amber-50/70 dark:bg-amber-950/15',
  Silver: 'bg-slate-50/70 dark:bg-slate-900/20',
  Gold: 'bg-yellow-50/70 dark:bg-yellow-950/15',
  Diamond: 'bg-cyan-50/70 dark:bg-cyan-950/15',
  Legendary: 'bg-violet-50/70 dark:bg-violet-950/20',
};

export const TIER_GLOW: Record<TierKey, string> = {
  Emerging: '',
  Bronze: 'hover:shadow-amber-200/30 dark:hover:shadow-amber-900/20',
  Silver: 'hover:shadow-slate-200/30 dark:hover:shadow-slate-700/20',
  Gold: 'hover:shadow-yellow-200/40 dark:hover:shadow-yellow-900/30',
  Diamond: 'hover:shadow-cyan-200/40 dark:hover:shadow-cyan-900/30',
  Legendary: 'hover:shadow-violet-200/50 dark:hover:shadow-violet-900/40',
};

export const TIER_LEFT_ACCENT: Record<TierKey, string> = {
  Emerging: 'border-l-2 border-l-border',
  Bronze: 'border-l-2 border-l-amber-500/60 dark:border-l-amber-600/50',
  Silver: 'border-l-2 border-l-slate-400/60 dark:border-l-slate-500/50',
  Gold: 'border-l-2 border-l-yellow-500/70 dark:border-l-yellow-500/60',
  Diamond: 'border-l-2 border-l-cyan-500/70 dark:border-l-cyan-400/60',
  Legendary: 'border-l-2 border-l-violet-500/70 dark:border-l-violet-400/60',
};

export const TIER_BADGE_BG: Record<TierKey, string> = {
  Emerging: 'bg-muted text-muted-foreground',
  Bronze:
    'bg-amber-100 text-amber-700 border border-amber-300/60 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/40',
  Silver:
    'bg-slate-100 text-slate-600 border border-slate-300/60 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-600/40',
  Gold: 'bg-yellow-100 text-yellow-700 border border-yellow-300/60 dark:bg-yellow-950/50 dark:text-yellow-400 dark:border-yellow-800/40',
  Diamond:
    'bg-cyan-100 text-cyan-700 border border-cyan-300/60 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-700/40',
  Legendary:
    'bg-violet-100 text-violet-700 border border-violet-300/60 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-700/50',
};

export function tierKey(tier: string | null | undefined): TierKey {
  const valid: TierKey[] = ['Emerging', 'Bronze', 'Silver', 'Gold', 'Diamond', 'Legendary'];
  return valid.includes(tier as TierKey) ? (tier as TierKey) : 'Emerging';
}
