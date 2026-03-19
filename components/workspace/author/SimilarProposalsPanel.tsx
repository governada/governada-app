'use client';

/**
 * SimilarProposalsPanel — shows existing on-chain proposals that are
 * semantically similar to the current draft.
 *
 * Triggered by a manual "Check for Similar" button click (not automatic).
 * Results are cached in component state to avoid refetching on every render.
 */

import { useState, useCallback } from 'react';
import { Search, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import type { SimilarProposalResponse } from '@/app/api/workspace/drafts/[draftId]/similar/route';

interface SimilarProposalsPanelProps {
  draftId: string;
}

const statusColors: Record<string, string> = {
  'In Voting': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  Ratified: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  Enacted: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  Expired: 'bg-muted text-muted-foreground border-border',
  Dropped: 'bg-muted text-muted-foreground border-border',
};

function SimilarityBadge({ similarity }: { similarity: number }) {
  const pct = Math.round(similarity * 100);
  let color = 'bg-muted text-muted-foreground';
  if (pct >= 80) color = 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  else if (pct >= 60) color = 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';

  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${color}`}>
      {pct}% similar
    </Badge>
  );
}

export function SimilarProposalsPanel({ draftId }: SimilarProposalsPanelProps) {
  const [results, setResults] = useState<SimilarProposalResponse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      try {
        const { getStoredSession } = await import('@/lib/supabaseAuth');
        const token = getStoredSession();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch {
        // No session available
      }
      const res = await fetch(`/api/workspace/drafts/${encodeURIComponent(draftId)}/similar`, {
        headers,
      });
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setResults(data.similar ?? []);
    } catch (err) {
      setError('Failed to search for similar proposals');
      setResults(null);
      console.error('[SimilarProposalsPanel]', err);
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Search className="h-4 w-4 text-primary" />
          Similar Proposals
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Initial state: button to trigger search */}
        {results === null && !loading && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Check if similar proposals already exist on-chain to avoid duplicates and find
              precedent.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleSearch}
              disabled={loading}
            >
              <Search className="h-3.5 w-3.5 mr-2" />
              Check for Similar
            </Button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-4 gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Searching proposals...</span>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="space-y-2">
            <p className="text-xs text-rose-500">{error}</p>
            <Button variant="outline" size="sm" className="w-full" onClick={handleSearch}>
              Try Again
            </Button>
          </div>
        )}

        {/* Results */}
        {results !== null && !loading && (
          <div className="space-y-3">
            {results.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  No similar proposals found. Your draft appears to cover new ground.
                </p>
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={handleSearch}>
                  Search Again
                </Button>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Found {results.length} similar proposal{results.length !== 1 ? 's' : ''}
                </p>
                <div className="space-y-2">
                  {results.map((proposal) => (
                    <Link
                      key={`${proposal.txHash}-${proposal.proposalIndex}`}
                      href={`/proposal/${encodeURIComponent(proposal.txHash)}/${proposal.proposalIndex}`}
                      target="_blank"
                      className="block"
                    >
                      <div className="rounded-lg border border-border bg-muted/30 p-3 hover:bg-muted/50 transition-colors group">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="text-xs font-medium text-foreground truncate">
                              {proposal.title}
                            </span>
                          </div>
                          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <SimilarityBadge similarity={proposal.similarity} />
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${statusColors[proposal.status] ?? ''}`}
                          >
                            {proposal.status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {proposal.proposalType}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={handleSearch}>
                  Refresh
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
