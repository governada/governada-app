'use client';

import { useMemo } from 'react';
import { MessageSquare, Highlighter, AlertTriangle, BookOpen, Brain, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { useAnnotations } from '@/hooks/useAnnotations';
import type { ProposalAnnotation, AnnotationType } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_STYLES: Record<
  AnnotationType,
  { icon: typeof MessageSquare; label: string; color: string }
> = {
  concern: {
    icon: AlertTriangle,
    label: 'Concerns',
    color: 'text-red-600 dark:text-red-400',
  },
  note: {
    icon: MessageSquare,
    label: 'Notes',
    color: 'text-yellow-600 dark:text-yellow-400',
  },
  citation: {
    icon: BookOpen,
    label: 'Citations',
    color: 'text-blue-600 dark:text-blue-400',
  },
  highlight: {
    icon: Highlighter,
    label: 'Highlights',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  suggestion: {
    icon: Brain,
    label: 'Suggestions',
    color: 'text-sky-600 dark:text-sky-400',
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PublicFeedbackSummaryProps {
  proposalTxHash: string;
  proposalIndex: number;
}

// ---------------------------------------------------------------------------
// Group similar concern annotations for "top themes"
// ---------------------------------------------------------------------------

interface ConcernTheme {
  text: string;
  count: number;
  field: string;
}

function extractConcernThemes(concerns: ProposalAnnotation[]): ConcernTheme[] {
  // Group by overlapping ranges on the same field
  const grouped = new Map<string, { texts: string[]; field: string }>();
  for (const c of concerns) {
    // Create a coarse bucket key: field + 100-char window
    const bucket = `${c.anchorField}:${Math.floor(c.anchorStart / 100)}`;
    const existing = grouped.get(bucket);
    if (existing) {
      existing.texts.push(c.annotationText);
    } else {
      grouped.set(bucket, { texts: [c.annotationText], field: c.anchorField });
    }
  }

  return Array.from(grouped.values())
    .map((g) => ({
      text: g.texts[0], // representative
      count: g.texts.length,
      field: g.field,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PublicFeedbackSummary({
  proposalTxHash,
  proposalIndex,
}: PublicFeedbackSummaryProps) {
  const { data: allAnnotations, isLoading } = useAnnotations(proposalTxHash, proposalIndex);

  // Filter to public only
  const publicAnnotations = useMemo(
    () => (allAnnotations ?? []).filter((a) => a.isPublic),
    [allAnnotations],
  );

  const countsByType = useMemo(() => {
    const counts: Record<AnnotationType, number> = {
      concern: 0,
      note: 0,
      citation: 0,
      highlight: 0,
      suggestion: 0,
    };
    for (const a of publicAnnotations) {
      counts[a.annotationType]++;
    }
    return counts;
  }, [publicAnnotations]);

  const uniqueReviewers = useMemo(
    () => new Set(publicAnnotations.map((a) => a.userId)).size,
    [publicAnnotations],
  );

  const concernThemes = useMemo(
    () => extractConcernThemes(publicAnnotations.filter((a) => a.annotationType === 'concern')),
    [publicAnnotations],
  );

  if (isLoading) return null;
  if (publicAnnotations.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Community Feedback</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {uniqueReviewers} reviewer{uniqueReviewers !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Type counts */}
        <div className="grid grid-cols-2 gap-2">
          {(
            Object.entries(TYPE_STYLES) as [AnnotationType, (typeof TYPE_STYLES)[AnnotationType]][]
          ).map(([type, style]) => {
            const count = countsByType[type];
            if (count === 0) return null;
            const Icon = style.icon;
            return (
              <div
                key={type}
                className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5"
              >
                <Icon className={cn('h-3.5 w-3.5', style.color)} />
                <span className="text-xs text-foreground/80">
                  <span className="font-semibold tabular-nums">{count}</span> {style.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Top concern themes */}
        {concernThemes.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-medium text-muted-foreground">Top Concerns</h4>
            {concernThemes.map((theme, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md border border-red-200/50 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20 px-2.5 py-2"
              >
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-red-500 dark:text-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground/80 line-clamp-2">{theme.text}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {theme.field}
                    </span>
                    {theme.count > 1 && (
                      <span className="text-[10px] font-medium text-red-600 dark:text-red-400">
                        +{theme.count - 1} similar
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        <p className="text-[10px] text-muted-foreground text-center pt-1">
          {publicAnnotations.length} public annotation{publicAnnotations.length !== 1 ? 's' : ''}{' '}
          across {Object.values(countsByType).filter((c) => c > 0).length} categories
        </p>
      </CardContent>
    </Card>
  );
}
