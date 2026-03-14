'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageSquare, ShieldCheck, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RationaleEntry } from './ProposalTopRationales';

interface DebateSectionProps {
  rationales: RationaleEntry[];
}

function RationaleCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: RationaleEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const displayText = entry.rationaleAiSummary || entry.rationaleText;
  const hasFullText = entry.rationaleText != null && entry.rationaleText.length > 200;

  return (
    <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Link
          href={`/drep/${entry.drepId}`}
          className="text-sm font-medium hover:text-primary transition-colors truncate"
        >
          {entry.drepName || `${entry.drepId.slice(0, 16)}\u2026`}
        </Link>
        {entry.hashVerified === true && (
          <ShieldCheck
            className="h-3.5 w-3.5 text-green-500 shrink-0"
            aria-label="On-chain verified"
          />
        )}
        {entry.hashVerified === false && (
          <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-label="Hash mismatch" />
        )}
      </div>
      <p className={cn('text-sm text-foreground/80 leading-relaxed', !expanded && 'line-clamp-3')}>
        {expanded && hasFullText ? entry.rationaleText : displayText}
      </p>
      {hasFullText && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="h-3 w-3 ml-1" />
            </>
          ) : (
            <>
              Read more <ChevronDown className="h-3 w-3 ml-1" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}

export function DebateSection({ rationales }: DebateSectionProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const withRationale = rationales.filter((r) => r.rationaleAiSummary || r.rationaleText);
  const yesRationales = withRationale.filter((r) => r.vote === 'Yes');
  const noRationales = withRationale.filter((r) => r.vote === 'No');
  const abstainRationales = withRationale.filter((r) => r.vote === 'Abstain');

  return (
    <section className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            The Debate
          </h2>
          <span className="text-xs text-muted-foreground">
            {withRationale.length} rationale{withRationale.length !== 1 ? 's' : ''} published
          </span>
        </div>
      </div>

      <div className="p-6">
        {withRationale.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No representatives have published rationales yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* For column */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-8 rounded-full bg-emerald-500" />
                <span className="text-sm font-semibold text-emerald-400">
                  For ({yesRationales.length})
                </span>
              </div>
              {yesRationales.slice(0, 4).map((r) => (
                <RationaleCard
                  key={r.drepId}
                  entry={r}
                  expanded={expanded === r.drepId}
                  onToggle={() => setExpanded(expanded === r.drepId ? null : r.drepId)}
                />
              ))}
              {yesRationales.length === 0 && (
                <p className="text-sm text-muted-foreground/60 italic">
                  No supporting rationales yet
                </p>
              )}
            </div>

            {/* Against column */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-8 rounded-full bg-red-500" />
                <span className="text-sm font-semibold text-red-400">
                  Against ({noRationales.length})
                </span>
              </div>
              {noRationales.slice(0, 4).map((r) => (
                <RationaleCard
                  key={r.drepId}
                  entry={r}
                  expanded={expanded === r.drepId}
                  onToggle={() => setExpanded(expanded === r.drepId ? null : r.drepId)}
                />
              ))}
              {noRationales.length === 0 && (
                <p className="text-sm text-muted-foreground/60 italic">
                  No opposing rationales yet
                </p>
              )}
            </div>
          </div>
        )}

        {/* Abstain rationales */}
        {abstainRationales.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-8 rounded-full bg-amber-500" />
              <span className="text-sm font-semibold text-amber-400">
                Abstained ({abstainRationales.length})
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {abstainRationales.slice(0, 2).map((r) => (
                <RationaleCard
                  key={r.drepId}
                  entry={r}
                  expanded={expanded === r.drepId}
                  onToggle={() => setExpanded(expanded === r.drepId ? null : r.drepId)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
