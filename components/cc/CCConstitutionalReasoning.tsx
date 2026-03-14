'use client';

import { useMemo } from 'react';
import { BookOpen, AlertTriangle, FileText } from 'lucide-react';
import { EXPECTED_ARTICLES } from '@/lib/cc/fidelityScore';
import type { EnrichedVote } from '@/components/cc/CCMemberProfileClient';

interface CCConstitutionalReasoningProps {
  votes: EnrichedVote[];
}

export function CCConstitutionalReasoning({ votes }: CCConstitutionalReasoningProps) {
  // Article citation frequency
  const articleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of votes) {
      for (const article of v.citedArticles) {
        counts.set(article, (counts.get(article) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [votes]);

  const maxCitations = articleCounts.length > 0 ? articleCounts[0][1] : 1;

  // Blind spots: expected articles per proposal type that were never cited
  const blindSpots = useMemo(() => {
    const allCitedArticles = new Set<string>();
    for (const v of votes) {
      for (const article of v.citedArticles) {
        allCitedArticles.add(article);
      }
    }

    // Collect proposal types this member voted on
    const votedTypes = new Set(votes.map((v) => v.proposalType));

    const spots: Array<{ proposalType: string; missingArticles: string[] }> = [];
    for (const type of votedTypes) {
      const expected = EXPECTED_ARTICLES[type];
      if (!expected) continue;
      const missing = expected.filter((exp) => {
        // Fuzzy match: same logic as fidelityScore.ts
        const parts = exp.split(/[,\xA7\s]+/).filter(Boolean);
        return !Array.from(allCitedArticles).some((cited) =>
          parts.every((part) => cited.includes(part)),
        );
      });
      if (missing.length > 0) {
        spots.push({ proposalType: type, missingArticles: missing });
      }
    }
    return spots;
  }, [votes]);

  // Rationale quality distribution
  const rationaleStats = useMemo(() => {
    const withRationale = votes.filter((v) => v.hasRationale).length;
    const withParsedRationale = votes.filter((v) => v.rationaleSummary).length;
    const withArticles = votes.filter((v) => v.citedArticles.length > 0).length;
    return {
      total: votes.length,
      withRationale,
      withoutRationale: votes.length - withRationale,
      withParsedRationale,
      withArticles,
    };
  }, [votes]);

  if (votes.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-5 text-center">
        <p className="text-sm text-muted-foreground">No votes to analyze.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Article Citation Frequency */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Article Citation Frequency
        </h3>
        {articleCounts.length > 0 ? (
          <div className="space-y-2">
            {articleCounts.map(([article, count]) => (
              <div key={article} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-40 shrink-0 truncate">
                  {article}
                </span>
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky-500/70"
                    style={{ width: `${(count / maxCitations) * 100}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                  {count}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No constitutional articles cited in any rationale.
          </p>
        )}
      </div>

      {/* Blind Spots */}
      {blindSpots.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Citation Blind Spots
          </h3>
          <p className="text-xs text-muted-foreground">
            Expected constitutional articles for voted proposal types that were never cited.
          </p>
          <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
            {blindSpots.map(({ proposalType, missingArticles }) => (
              <div key={proposalType} className="px-4 py-2.5 space-y-1">
                <p className="text-xs font-medium">{proposalType}</p>
                <div className="flex flex-wrap gap-1.5">
                  {missingArticles.map((article) => (
                    <span
                      key={article}
                      className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px]"
                    >
                      {article}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rationale Quality Distribution */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Rationale Quality Distribution
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3 text-center space-y-1">
            <p className="text-lg font-bold tabular-nums text-emerald-500">
              {rationaleStats.withRationale}
            </p>
            <p className="text-[10px] text-muted-foreground">With Rationale</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3 text-center space-y-1">
            <p className="text-lg font-bold tabular-nums text-rose-500">
              {rationaleStats.withoutRationale}
            </p>
            <p className="text-[10px] text-muted-foreground">Without Rationale</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3 text-center space-y-1">
            <p className="text-lg font-bold tabular-nums text-sky-500">
              {rationaleStats.withArticles}
            </p>
            <p className="text-[10px] text-muted-foreground">With Article Citations</p>
          </div>
        </div>
        {rationaleStats.total > 0 && (
          <div className="h-3 rounded-full bg-muted overflow-hidden flex">
            {rationaleStats.withRationale > 0 && (
              <div
                className="h-full bg-emerald-500/70"
                style={{
                  width: `${(rationaleStats.withRationale / rationaleStats.total) * 100}%`,
                }}
              />
            )}
            {rationaleStats.withoutRationale > 0 && (
              <div
                className="h-full bg-rose-500/30"
                style={{
                  width: `${(rationaleStats.withoutRationale / rationaleStats.total) * 100}%`,
                }}
              />
            )}
          </div>
        )}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500/70" /> With rationale
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500/30" /> Without rationale
          </span>
        </div>
      </div>
    </div>
  );
}
