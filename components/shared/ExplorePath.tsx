'use client';

import Link from 'next/link';
import { ChevronRight, X, ArrowRight } from 'lucide-react';
import { useExplorePath } from '@/hooks/useExplorePath';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { cn } from '@/lib/utils';
import type { EntityConnection } from '@/lib/entityConnections';

interface ExplorePathProps {
  /** Optional suggestions from entity connections to show as "Next:" links */
  suggestions?: EntityConnection[];
}

/**
 * Explore Path — client-side breadcrumb tracking entity page traversal.
 * Only appears after 2+ entity page visits in a session.
 * Shows "Next:" suggestions when connections data is available.
 */
export function ExplorePath({ suggestions }: ExplorePathProps) {
  const { explorePath, showPath, goToStep, clearPath } = useExplorePath();
  const { t } = useTranslation();

  if (!showPath) return null;

  // Filter suggestions to entity links only (not self-references)
  const nextSuggestions = (suggestions ?? [])
    .filter((s) => !s.personalized && s.href !== explorePath[explorePath.length - 1]?.href)
    .slice(0, 2);

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto scrollbar-none py-1">
        {explorePath.map((step, idx) => {
          const isLast = idx === explorePath.length - 1;
          return (
            <span key={`${step.type}-${step.id}`} className="flex items-center gap-1 shrink-0">
              {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
              {isLast ? (
                <span className="font-medium text-foreground/70 truncate max-w-[120px]">
                  {step.label}
                </span>
              ) : (
                <Link
                  href={step.href}
                  onClick={() => goToStep(idx)}
                  className={cn(
                    'truncate max-w-[120px] hover:text-foreground transition-colors',
                    'underline decoration-muted-foreground/30 underline-offset-2',
                  )}
                >
                  {step.label}
                </Link>
              )}
            </span>
          );
        })}
        <button
          onClick={clearPath}
          className="ml-1 rounded p-0.5 text-muted-foreground/40 hover:text-foreground/60 transition-colors shrink-0"
          aria-label={t('Clear explore path')}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {/* Next step suggestions */}
      {nextSuggestions.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
          <ArrowRight className="h-2.5 w-2.5" />
          <span>{t('Next')}:</span>
          {nextSuggestions.map((s, i) => (
            <span key={s.href} className="flex items-center gap-1">
              {i > 0 && <span>·</span>}
              <Link
                href={s.href}
                className="underline decoration-dotted underline-offset-2 hover:text-foreground/60 truncate max-w-[140px]"
              >
                {s.label}
              </Link>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
