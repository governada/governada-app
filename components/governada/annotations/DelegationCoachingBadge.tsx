'use client';

/**
 * DelegationCoachingBadge — Ambient coaching insight for delegation decisions.
 *
 * Renders coaching from the citizen cohort analysis as a SenecaAnnotation
 * with an optional "View DRep" action link.
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SenecaAnnotation } from './SenecaAnnotation';
import { useDelegationCoaching } from '@/hooks/useDelegationCoaching';
import { cn } from '@/lib/utils';
import { useCallback, useState } from 'react';
import posthog from 'posthog-js';

interface DelegationCoachingBadgeProps {
  className?: string;
  /** Only render if user is authenticated */
  isAuthenticated?: boolean;
}

export function DelegationCoachingBadge({
  className,
  isAuthenticated,
}: DelegationCoachingBadgeProps) {
  const { insights, cohortSize } = useDelegationCoaching(!!isAuthenticated);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const handleDismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
  }, []);

  const visibleInsights = insights.filter((i) => !dismissed.has(i.id));
  if (visibleInsights.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {visibleInsights.map((insight) => (
        <div key={insight.id} className="flex flex-col gap-1">
          <SenecaAnnotation
            annotation={{
              id: insight.id,
              type: insight.type === 'better_match' ? 'alignment_drift' : 'delegation_nudge',
              text: insight.text,
              variant: insight.variant,
              provenance: insight.provenance,
            }}
            onDismiss={handleDismiss}
          />
          {insight.suggestedDrep && (
            <Link
              href={`/drep/${encodeURIComponent(insight.suggestedDrep.drepId)}`}
              onClick={() => {
                posthog.capture('delegation_coaching_clicked', {
                  suggested_drep: insight.suggestedDrep!.drepId,
                  cohort_size: cohortSize,
                  insight_type: insight.type,
                });
              }}
              className={cn(
                'ml-7 flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                'text-xs text-primary/70 hover:text-primary',
                'bg-primary/5 hover:bg-primary/10 border border-primary/10',
                'transition-colors w-fit',
              )}
            >
              View {insight.suggestedDrep.name}
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
