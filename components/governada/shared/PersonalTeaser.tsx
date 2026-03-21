'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type TeaserVariant =
  | 'alignment'
  | 'stake_impact'
  | 'pool_comparison'
  | 'treasury_impact'
  | 'participation_score';

interface PersonalTeaserProps {
  /** What the teaser is about — determines the message */
  variant: TeaserVariant;
  /** Entity name for personalized messages (e.g., DRep name) */
  entityName?: string;
  /** Additional CSS classes */
  className?: string;
}

const VARIANT_CONFIG: Record<
  TeaserVariant,
  { getMessage: (entityName?: string) => string; fakeValue: string }
> = {
  alignment: {
    getMessage: (entityName) =>
      entityName ? `Your alignment with ${entityName}:` : 'Your governance alignment:',
    fakeValue: '87%',
  },
  stake_impact: {
    getMessage: () => 'How this proposal affects YOUR stake →',
    fakeValue: '₳ 2,340',
  },
  pool_comparison: {
    getMessage: () => "Your pool's governance score vs top performers →",
    fakeValue: '72/100',
  },
  treasury_impact: {
    getMessage: () => 'Impact on YOUR delegation if this passes →',
    fakeValue: '₳ 1.2M',
  },
  participation_score: {
    getMessage: () => 'Your governance participation score →',
    fakeValue: '64/100',
  },
};

export function PersonalTeaser({ variant, entityName, className }: PersonalTeaserProps) {
  const { segment } = useSegment();

  if (segment !== 'anonymous') return null;

  const { getMessage, fakeValue } = VARIANT_CONFIG[variant];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border border-border/50 bg-card/30 px-3 py-1.5',
        className,
      )}
    >
      <span className="text-sm text-muted-foreground">{getMessage(entityName)}</span>
      <span
        className="select-none text-sm font-semibold text-foreground blur-sm"
        aria-hidden="true"
      >
        {fakeValue}
      </span>
      <Link
        href="/get-started"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Lock className="h-3 w-3" />
        Connect to reveal
      </Link>
    </div>
  );
}
