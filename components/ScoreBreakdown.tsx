'use client';

/**
 * Score Breakdown Component
 * Provides tooltip content for DRep Score breakdown
 * Shows: Engagement Quality (40%), Effective Participation (25%), Reliability (25%), Governance Identity (10%)
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
  engagementQuality: 0.4,
  effectiveParticipation: 0.25,
  reliability: 0.25,
  governanceIdentity: 0.1,
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
      label: 'Engagement Quality',
      value: applyRationaleCurve(safeRationale),
      weight: WEIGHTS.engagementQuality,
      description:
        'Rationale provision, AI-assessed quality, and deliberation signals. Outcome-blind scoring rewards quality reasoning regardless of vote direction.',
    },
    {
      label: 'Effective Participation',
      value: safeEffectiveParticipation,
      weight: WEIGHTS.effectiveParticipation,
      description:
        'Importance-weighted voting coverage. Critical proposals count 3x, close-margin proposals get a 1.5x bonus.',
    },
    {
      label: 'Reliability',
      value: safeReliability,
      weight: WEIGHTS.reliability,
      description:
        'Can delegators count on this DRep to keep showing up? Measures active streak, recency, gaps, and tenure.',
    },
    {
      label: 'Governance Identity',
      value: safeProfileCompleteness,
      weight: WEIGHTS.governanceIdentity,
      description:
        'Profile quality (CIP-119 metadata with staleness decay) and delegation health (retention, diversity, growth).',
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

export function ScoreBreakdown({}: { drep: EnrichedDRep }) {
  return null;
}
