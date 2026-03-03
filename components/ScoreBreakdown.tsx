'use client';

/**
 * Score Breakdown Component
 * Provides tooltip content for DRep Score breakdown
 * Shows: Rationale (35%), Effective Participation (30%), Reliability (20%), Profile (15%)
 */

import { EnrichedDRep } from '@/lib/koios';
import { applyRationaleCurve } from '@/utils/scoring';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ReactNode } from 'react';

interface ScoreBreakdownProps {
  drep: EnrichedDRep;
  children: ReactNode;
}

export const WEIGHTS = {
  effectiveParticipation: 0.3,
  rationale: 0.35,
  reliability: 0.2,
  profileCompleteness: 0.15,
};

export function ScoreBreakdownTooltip({ drep, children }: ScoreBreakdownProps) {
  const safeEffectiveParticipation = drep.effectiveParticipation ?? 0;
  const safeRationale = drep.rationaleRate ?? 0;
  const safeReliability = drep.reliabilityScore ?? 0;
  const safeProfileCompleteness = drep.profileCompleteness ?? 0;
  const deliberationModifier = drep.deliberationModifier ?? 1.0;
  const hasRubberStampDiscount = deliberationModifier < 1.0;

  const components = [
    {
      label: 'Effective Participation',
      value: safeEffectiveParticipation,
      weight: WEIGHTS.effectiveParticipation,
      description:
        'How often this DRep votes on available proposals. Discounted if voting pattern suggests rubber-stamping.',
    },
    {
      label: 'Rationale',
      value: applyRationaleCurve(safeRationale),
      weight: WEIGHTS.rationale,
      description:
        'Weighted by proposal importance. InfoActions excluded. Curve-adjusted to reward consistent effort.',
    },
    {
      label: 'Reliability',
      value: safeReliability,
      weight: WEIGHTS.reliability,
      description:
        'Can delegators count on this DRep to keep showing up? Measures voting streak, recency, and gaps.',
    },
    {
      label: 'Profile Completeness',
      value: safeProfileCompleteness,
      weight: WEIGHTS.profileCompleteness,
      description:
        'CIP-119 metadata completeness: objectives, motivations, qualifications, and verified social links.',
    },
  ];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold text-sm">Score Breakdown</p>
            {components.map((comp) => {
              const points = Math.round(comp.value * comp.weight);
              return (
                <div key={comp.label} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span>{comp.label}</span>
                    <span className="font-medium">
                      {comp.value}/100 ({Math.round(comp.weight * 100)}%)
                    </span>
                  </div>
                  <p className="text-xs text-background/70">{comp.description}</p>
                  <p className="text-xs">
                    Contributes: <span className="font-semibold">{points} pts</span>
                  </p>
                </div>
              );
            })}
            {hasRubberStampDiscount && (
              <p className="text-xs text-amber-300 pt-1 border-t border-background/20">
                Note: Participation discounted due to &gt;
                {deliberationModifier === 0.7 ? '95' : deliberationModifier === 0.85 ? '90' : '85'}%
                uniform voting pattern.
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ScoreBreakdown({ drep }: { drep: EnrichedDRep }) {
  return null;
}
