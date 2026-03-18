'use client';

/**
 * AmendmentIntelPanel — Intel tab content for the amendment editor.
 *
 * Shows in the StudioPanel intel tab:
 * - Amendment summary (changes grouped by article with inline diff)
 * - Conflict check button + results
 * - Section sentiment bars for amended sections
 */

import { useState, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAmendmentSentiment } from '@/hooks/useAmendmentSentiment';
import { CONSTITUTION_NODES } from '@/lib/constitution/fullText';
import type { AmendmentChange, AmendmentConflict } from '@/lib/constitution/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AmendmentIntelPanelProps {
  draftId: string;
  changes: AmendmentChange[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getArticleTitle(articleId: string): string {
  const node = CONSTITUTION_NODES.find((n) => n.id === articleId);
  return node?.title ?? articleId;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  accepted: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

const SEVERITY_COLORS: Record<string, string> = {
  info: 'text-blue-400',
  warning: 'text-amber-400',
  critical: 'text-rose-400',
};

const SEVERITY_ICONS: Record<string, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  critical: Shield,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AmendmentIntelPanel({ draftId, changes }: AmendmentIntelPanelProps) {
  const [conflictLoading, setConflictLoading] = useState(false);
  const [conflicts, setConflicts] = useState<AmendmentConflict[] | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());

  const { data: sentimentData } = useAmendmentSentiment(draftId);

  // Group changes by article
  const byArticle = useMemo(() => {
    const map = new Map<string, AmendmentChange[]>();
    for (const c of changes) {
      const list = map.get(c.articleId) ?? [];
      list.push(c);
      map.set(c.articleId, list);
    }
    return map;
  }, [changes]);

  const toggleArticle = useCallback((articleId: string) => {
    setExpandedArticles((prev) => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      return next;
    });
  }, []);

  const handleConflictCheck = useCallback(async () => {
    setConflictLoading(true);
    setConflictError(null);
    try {
      const res = await fetch('/api/ai/skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill: 'amendment-conflict-check',
          input: { changes, draftId },
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setConflicts(data.output?.conflicts ?? []);
    } catch (err) {
      setConflictError(err instanceof Error ? err.message : 'Conflict check failed');
    } finally {
      setConflictLoading(false);
    }
  }, [changes, draftId]);

  const sections = sentimentData?.sections ?? {};

  return (
    <div className="p-3 space-y-4">
      {/* Section 1: Amendment Summary */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Amendment Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          {changes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No changes proposed yet.</p>
          ) : (
            Array.from(byArticle.entries()).map(([articleId, articleChanges]) => (
              <div key={articleId} className="border border-border/30 rounded-md overflow-hidden">
                {/* Article header */}
                <button
                  onClick={() => toggleArticle(articleId)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  {expandedArticles.has(articleId) ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-xs font-medium truncate flex-1">
                    {getArticleTitle(articleId)}
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    {articleChanges.length}
                  </Badge>
                </button>

                {/* Expanded changes */}
                {expandedArticles.has(articleId) && (
                  <div className="border-t border-border/30 px-2.5 py-2 space-y-2">
                    {articleChanges.map((change) => (
                      <div key={change.id} className="space-y-1">
                        {/* Inline diff */}
                        <div className="text-[11px] leading-relaxed">
                          <span className="line-through text-rose-400/80 bg-rose-500/10 px-0.5 rounded">
                            {change.originalText.slice(0, 120)}
                            {change.originalText.length > 120 ? '...' : ''}
                          </span>{' '}
                          <span className="text-emerald-400/80 bg-emerald-500/10 px-0.5 rounded">
                            {change.proposedText.slice(0, 120)}
                            {change.proposedText.length > 120 ? '...' : ''}
                          </span>
                        </div>
                        {/* Explanation + status */}
                        <div className="flex items-center gap-2">
                          {change.explanation && (
                            <span className="text-[10px] text-muted-foreground truncate flex-1">
                              {change.explanation}
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1 py-0 ${STATUS_COLORS[change.status] ?? ''}`}
                          >
                            {change.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Section 2: Conflict Check */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Conflict Check
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          {conflicts === null ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleConflictCheck}
              disabled={conflictLoading || changes.length === 0}
              className="w-full text-xs"
            >
              {conflictLoading ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Shield className="mr-1.5 h-3 w-3" />
                  Run Conflict Check
                </>
              )}
            </Button>
          ) : conflicts.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              No conflicts found
            </div>
          ) : (
            conflicts.map((conflict, i) => {
              const Icon = SEVERITY_ICONS[conflict.severity] ?? Info;
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${SEVERITY_COLORS[conflict.severity] ?? ''}`}
                  />
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-medium">
                      {conflict.amendedArticle} vs {conflict.conflictingArticle}
                    </p>
                    <p className="text-muted-foreground">{conflict.description}</p>
                  </div>
                </div>
              );
            })
          )}
          {conflictError && <p className="text-xs text-destructive">{conflictError}</p>}
        </CardContent>
      </Card>

      {/* Section 3: Section Sentiment */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Section Sentiment
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          {changes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sentiment data will appear when amendments are proposed.
            </p>
          ) : (
            Array.from(byArticle.keys()).map((articleId) => {
              const sentiment = sections[articleId];
              const total = sentiment?.total ?? 0;
              const support = sentiment?.support ?? 0;
              const oppose = sentiment?.oppose ?? 0;
              const neutral = sentiment?.neutral ?? 0;

              return (
                <div key={articleId} className="space-y-1">
                  <span className="text-[10px] font-medium truncate block">
                    {getArticleTitle(articleId)}
                  </span>
                  {total > 0 ? (
                    <div className="flex h-2 rounded-full overflow-hidden bg-muted/50">
                      {support > 0 && (
                        <div
                          className="bg-emerald-500 transition-all"
                          style={{ width: `${(support / total) * 100}%` }}
                        />
                      )}
                      {neutral > 0 && (
                        <div
                          className="bg-muted-foreground/40 transition-all"
                          style={{ width: `${(neutral / total) * 100}%` }}
                        />
                      )}
                      {oppose > 0 && (
                        <div
                          className="bg-amber-500 transition-all"
                          style={{ width: `${(oppose / total) * 100}%` }}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="h-2 rounded-full bg-muted/30" />
                  )}
                  <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                    <span>{support} support</span>
                    <span>{neutral} neutral</span>
                    <span>{oppose} oppose</span>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
