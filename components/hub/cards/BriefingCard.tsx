'use client';

import { useState } from 'react';
import { Newspaper, ChevronDown, ChevronUp, Thermometer } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { HubCardSkeleton } from './HubCard';
import { useGovernanceTemperature } from '@/hooks/useGovernanceTemperature';

interface BriefingHeadline {
  title: string;
  description: string;
  type: string;
}

interface BriefingData {
  epoch: number;
  status?: {
    health?: string;
    headline?: string;
  };
  headlines?: BriefingHeadline[];
  recap?: {
    narrative?: string;
  };
}

/**
 * BriefingCard — The citizen's epoch intelligence surface on the Hub.
 *
 * Surfaces the current epoch's AI-written briefing: governance health
 * headline + top 2-3 news items. Expands inline to show the full narrative.
 *
 * Self-hides when no briefing data is available yet (e.g. first epoch).
 *
 * JTBD: "What happened in governance this epoch?"
 * Links to the full briefing page /governance/briefing.
 */
export function BriefingCard() {
  const [expanded, setExpanded] = useState(false);
  const { temperature, label: tempLabel } = useGovernanceTemperature();

  const { data: raw, isLoading } = useQuery({
    queryKey: ['citizen-briefing-hub'],
    queryFn: async () => {
      const res = await fetch('/api/briefing/citizen');
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<BriefingData>;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <HubCardSkeleton />;

  const data = raw as BriefingData | undefined;
  const headlines = data?.headlines ?? [];
  const narrative = data?.recap?.narrative ?? null;
  const health = data?.status?.health;

  // No briefing data — show governance temperature as fallback instead of hiding
  if (!data || (headlines.length === 0 && !narrative && !data.status?.headline)) {
    const tempColor =
      tempLabel === 'urgent'
        ? 'text-red-600 dark:text-red-400'
        : tempLabel === 'warm'
          ? 'text-amber-600 dark:text-amber-400'
          : tempLabel === 'cool'
            ? 'text-sky-600 dark:text-sky-400'
            : 'text-muted-foreground';
    const tempDescription =
      tempLabel === 'urgent'
        ? 'Contested votes and high activity — governance needs attention'
        : tempLabel === 'warm'
          ? 'Active governance period — proposals are being debated'
          : tempLabel === 'cool'
            ? 'Quiet period — governance is stable with low activity'
            : 'Normal governance activity this epoch';
    return (
      <div
        className={cn(
          'group block min-h-[6.5rem] rounded-2xl border p-4 sm:p-5',
          'border-white/[0.08] bg-card/15 backdrop-blur-md',
        )}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Governance Climate
            </span>
          </div>
          <p className={cn('text-base font-semibold capitalize', tempColor)}>
            {tempLabel} — {Math.round(temperature)}°
          </p>
          <p className="text-sm text-muted-foreground">{tempDescription}</p>
        </div>
      </div>
    );
  }

  const previewHeadlines = headlines.slice(0, 2);
  const hasMore = !!narrative || headlines.length > 2;

  const healthColor =
    health === 'green'
      ? 'text-emerald-600 dark:text-emerald-400'
      : health === 'red'
        ? 'text-red-600 dark:text-red-400'
        : 'text-muted-foreground';

  return (
    <div
      className={cn(
        'group block min-h-[6.5rem] rounded-2xl border p-4 sm:p-5',
        'transition-all duration-200 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'border-white/[0.08] bg-card/15 backdrop-blur-md',
      )}
    >
      {/* Header row — always a link to the full briefing */}
      <a
        href="/governance/briefing"
        aria-label={`Epoch ${data.epoch} briefing — read more`}
        className="block"
        onClick={(e) => {
          // If expanding, swallow the link click so expansion works inline
          if (hasMore && !expanded) {
            e.preventDefault();
            setExpanded(true);
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Epoch {data.epoch} Briefing
              </span>
            </div>

            {data.status?.headline && (
              <p className={cn('text-base font-semibold', healthColor)}>{data.status.headline}</p>
            )}

            {/* Preview headlines */}
            {previewHeadlines.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {previewHeadlines.map((h, i) => (
                  <li key={i} className="text-sm text-muted-foreground truncate">
                    <span className="text-primary font-bold mr-1.5">&bull;</span>
                    {h.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </a>

      {/* Expand / collapse toggle */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:underline"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              Read more
            </>
          )}
        </button>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {narrative && <p className="text-sm leading-relaxed text-foreground">{narrative}</p>}

          {headlines.length > 2 && (
            <ul className="space-y-1.5">
              {headlines.slice(2).map((h, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  <span className="text-primary font-bold mr-1.5">&bull;</span>
                  <span className="font-medium text-foreground">{h.title}</span>
                  {' — '}
                  {h.description}
                </li>
              ))}
            </ul>
          )}

          <a
            href="/governance/briefing"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Full briefing
            <span aria-hidden>&rarr;</span>
          </a>
        </div>
      )}
    </div>
  );
}
