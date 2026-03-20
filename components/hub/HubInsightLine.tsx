'use client';

/**
 * HubInsightLine — Perplexity-style one-line insight with source citation.
 *
 * Renders a subtle AI-generated insight below a Hub card's main content.
 * Includes a citation link for provenance (Harvey/Elicit pattern).
 * Non-intrusive: muted text that enhances without overwhelming.
 */

import Link from 'next/link';
import { Sparkles, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HubInsight } from '@/lib/intelligence/hub-insights';

interface HubInsightLineProps {
  insight: HubInsight | undefined;
  className?: string;
}

export function HubInsightLine({ insight, className }: HubInsightLineProps) {
  if (!insight) return null;

  return (
    <div
      className={cn('flex items-start gap-1.5 mt-2 pt-2 border-t border-white/[0.04]', className)}
    >
      <Sparkles className="h-3 w-3 shrink-0 mt-0.5 text-primary/40" aria-hidden />
      <p className="text-[11px] leading-relaxed text-muted-foreground/70 flex-1 min-w-0">
        <span>{insight.text}</span>
        {insight.citation && (
          <Link
            href={insight.citation.href}
            className="inline-flex items-center gap-0.5 ml-1 text-primary/50 hover:text-primary transition-colors"
            aria-label={`Source: ${insight.citation.label}`}
          >
            <span className="text-[10px] underline underline-offset-2">
              {insight.citation.label}
            </span>
            <ExternalLink className="h-2.5 w-2.5" aria-hidden />
          </Link>
        )}
      </p>
    </div>
  );
}

/** Skeleton for loading state */
export function HubInsightLineSkeleton() {
  return (
    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/[0.04]">
      <div className="h-3 w-3 rounded bg-muted/30 animate-pulse" />
      <div className="h-3 w-40 rounded bg-muted/20 animate-pulse" />
    </div>
  );
}
