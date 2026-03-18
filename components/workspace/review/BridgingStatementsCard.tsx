'use client';

/**
 * BridgingStatementsCard — AI-powered consensus discovery for amendment reviews.
 *
 * Renders bridging statements that surface points of agreement between
 * opposing reviewer perspectives. On-demand analysis via the amendment-bridge
 * AI skill, showing consensus/division areas as tag lists.
 */

import { Sparkles, Loader2, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAmendmentBridging } from '@/hooks/useAmendmentBridging';
import type { AmendmentChange } from '@/lib/constitution/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BridgingStatementsCardProps {
  draftId: string;
  amendments: AmendmentChange[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BridgingStatementsCard({ draftId, amendments }: BridgingStatementsCardProps) {
  const bridging = useAmendmentBridging(draftId);

  const output = bridging.data?.output;
  const hasAmendments = amendments.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-medium text-foreground">Points of Agreement</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Pre-analysis state */}
        {!output && !bridging.isPending && (
          <div className="text-center py-4 space-y-3">
            <p className="text-xs text-muted-foreground/60 leading-relaxed">
              Run analysis to surface points of agreement from community reviews
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={!hasAmendments || bridging.isPending}
              onClick={() => bridging.mutate()}
            >
              <Sparkles className="h-3 w-3 mr-1.5" />
              Analyze Community Feedback
            </Button>
            {!hasAmendments && (
              <p className="text-[10px] text-muted-foreground/40">No amendments to analyze yet</p>
            )}
          </div>
        )}

        {/* Loading state */}
        {bridging.isPending && (
          <div className="flex items-center justify-center gap-2 py-6">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Analyzing community feedback...</span>
          </div>
        )}

        {/* Error state */}
        {bridging.isError && (
          <div className="text-center py-4 space-y-2">
            <p className="text-xs text-destructive">Analysis failed. Please try again.</p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => bridging.mutate()}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Results */}
        {output && (
          <>
            {/* Bridging statements */}
            {output.bridges.map((bridge) => (
              <div
                key={bridge.id}
                className="rounded-md border border-border/40 bg-muted/20 p-3 space-y-2"
              >
                {/* Statement blockquote */}
                <div className="flex gap-2">
                  <Quote className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed text-foreground/90 italic">
                    {bridge.statement}
                  </p>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Support percentage badge */}
                  <span
                    className={cn(
                      'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums',
                      bridge.supportPercentage >= 70
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : bridge.supportPercentage >= 50
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    ~{Math.round(bridge.supportPercentage)}% agreement
                  </span>

                  {/* Relevant article badges */}
                  {bridge.relevantSections.map((section) => (
                    <span
                      key={section}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted/50 text-muted-foreground/60"
                    >
                      {section}
                    </span>
                  ))}
                </div>

                {/* Rationale */}
                {bridge.rationale && (
                  <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                    {bridge.rationale}
                  </p>
                )}
              </div>
            ))}

            {output.bridges.length === 0 && (
              <p className="text-xs text-muted-foreground/60 text-center py-2">
                No bridging statements could be generated from current reviews.
              </p>
            )}

            {/* Consensus areas */}
            {output.consensusAreas.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1.5">
                  Consensus Areas
                </p>
                <div className="flex flex-wrap gap-1">
                  {output.consensusAreas.map((area) => (
                    <span
                      key={area}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Division areas */}
            {output.divisionAreas.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1.5">
                  Division Areas
                </p>
                <div className="flex flex-wrap gap-1">
                  {output.divisionAreas.map((area) => (
                    <span
                      key={area}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/15"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Re-run button */}
            <div className="pt-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[10px] text-muted-foreground"
                onClick={() => bridging.mutate()}
                disabled={bridging.isPending}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Re-analyze
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
