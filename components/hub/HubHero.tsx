'use client';

import { GovernanceRings, type GovernanceRingsData } from '@/components/ui/GovernanceRings';
import { useSegment } from '@/components/providers/SegmentProvider';

interface HubHeroProps {
  pulseData: {
    activeProposals: number;
    activeDReps: number;
    totalDReps: number;
    totalDelegators: number;
  };
}

/**
 * HubHero — Governance Rings hero for the Hub page.
 * Shows rings + verdict + contextual subtitle.
 * Rings data is placeholder until engagement tracking is built.
 */
export function HubHero({ pulseData }: HubHeroProps) {
  const { segment } = useSegment();

  // Placeholder ring data until engagement metrics are computed
  // TODO: Wire to real participation/deliberation/impact scores
  const ringsData: GovernanceRingsData = {
    participation: segment === 'anonymous' ? 0 : 42,
    deliberation: segment === 'anonymous' ? 0 : 28,
    impact: segment === 'anonymous' ? 0 : 15,
  };

  const isAuthenticated = segment !== 'anonymous';

  return (
    <section className="flex flex-col items-center text-center py-[var(--space-2xl)] px-[var(--space-md)]">
      <GovernanceRings data={ringsData} size="hero" showLabels animate />

      <h1
        className="mt-6 font-display text-[2rem] font-semibold leading-tight tracking-tight text-foreground"
        style={{ fontFamily: 'var(--font-governada-display)' }}
      >
        {isAuthenticated ? 'Your governance at a glance.' : 'Cardano has a government.'}
      </h1>

      <p className="mt-2 max-w-md text-[var(--text-body-size)] leading-relaxed text-muted-foreground">
        {isAuthenticated ? (
          <>
            {pulseData.activeProposals > 0 && (
              <span>
                {pulseData.activeProposals} active proposal
                {pulseData.activeProposals !== 1 ? 's' : ''}.{' '}
              </span>
            )}
            <span>Close your governance rings by participating this epoch.</span>
          </>
        ) : (
          <>
            <span className="font-medium" style={{ fontFamily: 'var(--font-governada-display)' }}>
              {pulseData.activeDReps.toLocaleString()}
            </span>{' '}
            DReps represent{' '}
            <span className="font-medium" style={{ fontFamily: 'var(--font-governada-display)' }}>
              {pulseData.totalDelegators.toLocaleString()}
            </span>{' '}
            delegators. Know who represents your ADA.
          </>
        )}
      </p>
    </section>
  );
}
