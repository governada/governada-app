'use client';

import Link from 'next/link';
import { ChevronRight, X } from 'lucide-react';
import { useExplorePath } from '@/hooks/useExplorePath';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { cn } from '@/lib/utils';

/**
 * Explore Path — client-side breadcrumb tracking entity page traversal.
 * Only appears after 2+ entity page visits in a session.
 * Replaces traditional breadcrumbs when active.
 */
export function ExplorePath() {
  const { explorePath, showPath, goToStep, clearPath } = useExplorePath();
  const { t } = useTranslation();

  if (!showPath) return null;

  return (
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
  );
}
