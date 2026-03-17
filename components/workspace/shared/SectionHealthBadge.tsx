'use client';

/**
 * SectionHealthBadge — small colored dot indicating section analysis quality.
 *
 * Green = strong, Amber = adequate, Red = needs work, Pulsing gray = loading.
 */

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SectionHealthBadgeProps {
  quality: 'strong' | 'adequate' | 'needs_work' | null;
  loading?: boolean;
  flagCount?: number;
  gapCount?: number;
  className?: string;
}

const qualityConfig = {
  strong: { color: 'bg-emerald-500', label: 'Strong', description: 'Publication-ready' },
  adequate: { color: 'bg-amber-500', label: 'Adequate', description: 'Functional but improvable' },
  needs_work: { color: 'bg-rose-500', label: 'Needs work', description: 'Significant gaps' },
} as const;

export function SectionHealthBadge({
  quality,
  loading,
  flagCount,
  gapCount,
  className,
}: SectionHealthBadgeProps) {
  if (!quality && !loading) return null;

  if (loading) {
    return (
      <span
        className={cn(
          'inline-block h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse',
          className,
        )}
        aria-label="Analyzing..."
      />
    );
  }

  if (!quality) return null;
  const config = qualityConfig[quality];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn('inline-block h-2 w-2 rounded-full', config.color, className)}
            aria-label={config.label}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px]">
          <div className="space-y-1 text-xs">
            <div className="font-medium">{config.label}</div>
            <div className="text-muted-foreground">{config.description}</div>
            {(flagCount ?? 0) > 0 && (
              <div className="text-muted-foreground">
                {flagCount} constitutional {flagCount === 1 ? 'flag' : 'flags'}
              </div>
            )}
            {(gapCount ?? 0) > 0 && (
              <div className="text-muted-foreground">
                {gapCount} completeness {gapCount === 1 ? 'gap' : 'gaps'}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
