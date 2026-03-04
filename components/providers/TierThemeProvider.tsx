'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { computeTier, type TierName } from '@/lib/scoring/tiers';

export interface TierTheme {
  tier: TierName;
  className: string;
  glowIntensity: number;
}

const TIER_GLOW: Record<TierName, number> = {
  Emerging: 0,
  Bronze: 0.15,
  Silver: 0.2,
  Gold: 0.3,
  Diamond: 0.4,
  Legendary: 0.5,
};

const TierThemeContext = createContext<TierTheme>({
  tier: 'Emerging',
  className: 'tier-emerging',
  glowIntensity: 0,
});

function tierClassName(tier: TierName): string {
  return `tier-${tier.toLowerCase()}`;
}

interface TierThemeProviderProps {
  score: number | null | undefined;
  children: ReactNode;
}

/**
 * Sets tier-specific CSS variables via a class on the wrapping div.
 * Components inside inherit --tier-accent, --tier-glow, etc.
 * Pass score={null} for no tier ambient (e.g. anonymous users).
 */
export function TierThemeProvider({ score, children }: TierThemeProviderProps) {
  const theme = useMemo<TierTheme>(() => {
    if (score == null) {
      return { tier: 'Emerging', className: 'tier-emerging', glowIntensity: 0 };
    }
    const tier = computeTier(score);
    return {
      tier,
      className: tierClassName(tier),
      glowIntensity: TIER_GLOW[tier],
    };
  }, [score]);

  return (
    <TierThemeContext.Provider value={theme}>
      <div className={theme.className}>{children}</div>
    </TierThemeContext.Provider>
  );
}

export function useTierTheme(): TierTheme {
  return useContext(TierThemeContext);
}
