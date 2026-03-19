'use client';

/**
 * AuthorIntelligencePanel — sidebar showing section-by-section AI analysis.
 *
 * Updates on blur as the author edits each section. Shows constitutional flags,
 * completeness gaps, vagueness issues, and overall quality per section.
 */

import { useMemo } from 'react';
import { Brain, Shield, ListChecks, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { SectionHealthBadge } from '../shared/SectionHealthBadge';
import type { SectionAnalysisOutput } from '@/lib/ai/skills/section-analysis';

interface AuthorIntelligencePanelProps {
  results: Record<string, SectionAnalysisOutput | null>;
  loading: Record<string, boolean>;
  /** Timestamps of when each section was last analyzed (ISO string) */
  analyzedAt?: Record<string, string | null>;
  onApplyFix?: (field: string, search: string, replace: string) => void;
}

const SECTIONS: Array<{ field: string; label: string }> = [
  { field: 'abstract', label: 'Abstract' },
  { field: 'motivation', label: 'Motivation' },
  { field: 'rationale', label: 'Rationale' },
];

const severityColors = {
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  critical: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
} as const;

function formatTimeSince(iso: string): { label: string; isStale: boolean } {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  const isStale = mins > 10;
  if (mins < 1) return { label: 'just now', isStale };
  if (mins < 60) return { label: `${mins}m ago`, isStale };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { label: `${hours}h ago`, isStale };
  return { label: `${Math.floor(hours / 24)}d ago`, isStale };
}

export function AuthorIntelligencePanel({
  results,
  loading,
  analyzedAt,
  onApplyFix,
}: AuthorIntelligencePanelProps) {
  const hasAnyResult = Object.values(results).some((r) => r !== null);
  const hasAnyLoading = Object.values(loading).some((l) => l);

  // Compute staleness info outside of render to avoid impure Date.now() in JSX
  const stalenessInfo = useMemo(() => {
    if (!analyzedAt) return {};
    const info: Record<string, { label: string; isStale: boolean }> = {};
    for (const key of Object.keys(analyzedAt)) {
      const ts = analyzedAt[key];
      if (ts) info[key] = formatTimeSince(ts);
    }
    return info;
  }, [analyzedAt]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Brain className="h-4 w-4 text-primary" />
          Intelligence
          {hasAnyLoading && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasAnyResult && !hasAnyLoading ? (
          <p className="text-xs text-muted-foreground">
            Edit your proposal and section analysis will appear here automatically.
          </p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {SECTIONS.map(({ field, label }) => {
              const result = results[field];
              const isLoading = loading[field] ?? false;
              return (
                <AccordionItem key={field} value={field}>
                  <AccordionTrigger className="text-xs py-2 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <SectionHealthBadge
                        quality={result?.overallQuality ?? null}
                        loading={isLoading}
                        flagCount={result?.constitutionalFlags?.length}
                        gapCount={result?.completenessGaps?.length}
                      />
                      <span className="font-medium">{label}</span>
                      {result && (
                        <span className="text-muted-foreground font-normal truncate max-w-[140px]">
                          {result.summary}
                        </span>
                      )}
                      {stalenessInfo[field] && !isLoading && (
                        <span
                          className={`ml-auto text-[10px] shrink-0 ${
                            stalenessInfo[field].isStale
                              ? 'text-amber-400/70'
                              : 'text-muted-foreground/50'
                          }`}
                          title={
                            stalenessInfo[field].isStale ? 'Re-analyze on next edit' : undefined
                          }
                        >
                          {stalenessInfo[field].label}
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    {isLoading && !result && (
                      <div className="space-y-2">
                        <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                        <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                      </div>
                    )}
                    {result && (
                      <div className="space-y-3 text-xs">
                        {/* Constitutional flags */}
                        {result.constitutionalFlags.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Shield className="h-3 w-3" />
                              Constitutional
                            </div>
                            {result.constitutionalFlags.map((flag, i) => (
                              <div key={i} className="flex items-start gap-2 pl-4">
                                <Badge
                                  variant="secondary"
                                  className={`text-[10px] px-1.5 py-0 shrink-0 ${severityColors[flag.severity] ?? ''}`}
                                >
                                  {flag.severity}
                                </Badge>
                                <span>
                                  <span className="font-medium">{flag.article}:</span>{' '}
                                  {flag.concern}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Completeness gaps */}
                        {result.completenessGaps.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <ListChecks className="h-3 w-3" />
                              Completeness
                            </div>
                            {result.completenessGaps.map((gap, i) => (
                              <div key={i} className="pl-4">
                                <span className="font-medium">{gap.label}:</span> {gap.suggestion}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Vagueness issues */}
                        {result.vaguenessIssues.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Pencil className="h-3 w-3" />
                              Clarity
                            </div>
                            {result.vaguenessIssues.map((issue, i) => (
                              <div key={i} className="pl-4 flex items-start gap-1.5">
                                <div className="flex-1">
                                  <span className="text-muted-foreground italic">
                                    &ldquo;{issue.text}&rdquo;
                                  </span>
                                  <span className="mx-1">&rarr;</span>
                                  <span>{issue.suggestion}</span>
                                </div>
                                {onApplyFix && (
                                  <button
                                    onClick={() => onApplyFix(field, issue.text, issue.suggestion)}
                                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                                    title="Apply this suggestion"
                                  >
                                    Apply
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* All clear */}
                        {result.constitutionalFlags.length === 0 &&
                          result.completenessGaps.length === 0 &&
                          result.vaguenessIssues.length === 0 && (
                            <p className="text-muted-foreground">
                              This section is constitutionally sound and substantively complete.
                            </p>
                          )}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
