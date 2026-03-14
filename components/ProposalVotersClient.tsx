'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ProposalVoteDetail } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/EmptyState';
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  Heart,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CopyableAddress } from '@/components/CopyableAddress';
import { GovernanceRadar } from '@/components/GovernanceRadar';

interface ProposalVotersClientProps {
  votes: ProposalVoteDetail[];
  watchlist?: string[];
  delegatedDrepId?: string | null;
}

type VoteFilter = 'all' | 'Yes' | 'No' | 'Abstain';

export function ProposalVotersClient({
  votes,
  watchlist = [],
  delegatedDrepId,
}: ProposalVotersClientProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<VoteFilter>('all');
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [expandedRationale, setExpandedRationale] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = filter === 'all' ? votes : votes.filter((v) => v.vote === filter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (v) => (v.drepName || '').toLowerCase().includes(q) || v.drepId.toLowerCase().includes(q),
      );
    }

    if (showWatchlistOnly && watchlist.length > 0) {
      const wSet = new Set(watchlist);
      result = result.filter((v) => wSet.has(v.drepId));
    }

    // Pin delegated DRep to the top
    if (delegatedDrepId) {
      const pinned = result.filter((v) => v.drepId === delegatedDrepId);
      const rest = result.filter((v) => v.drepId !== delegatedDrepId);
      result = [...pinned, ...rest];
    }

    return result;
  }, [votes, filter, searchQuery, showWatchlistOnly, watchlist, delegatedDrepId]);

  const visible = showAll ? filtered : filtered.slice(0, 20);

  const yesCt = votes.filter((v) => v.vote === 'Yes').length;
  const noCt = votes.filter((v) => v.vote === 'No').length;
  const abCt = votes.filter((v) => v.vote === 'Abstain').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>DRep Votes ({votes.length})</CardTitle>
          <div className="flex gap-1.5">
            {(
              [
                { key: 'all', label: `All (${votes.length})` },
                { key: 'Yes', label: `Yes (${yesCt})` },
                { key: 'No', label: `No (${noCt})` },
                { key: 'Abstain', label: `Abstain (${abCt})` },
              ] as const
            ).map(({ key, label }) => (
              <Button
                key={key}
                variant={filter === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(key)}
                className="text-xs"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Search + quick filters */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search DReps by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-sm"
              aria-label="Search DReps by name or ID"
            />
          </div>

          {delegatedDrepId && votes.some((v) => v.drepId === delegatedDrepId) && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <UserCheck className="h-3 w-3" />
              Your DRep voted
            </Badge>
          )}

          {watchlist.length > 0 && (
            <Button
              variant={showWatchlistOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowWatchlistOnly(!showWatchlistOnly)}
              className="gap-1 text-xs h-8"
            >
              <Heart className="h-3 w-3" />
              Watchlist
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {visible.map((v) => {
            const isMyDrep = delegatedDrepId === v.drepId;

            return (
              <div
                key={v.voteTxHash}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/drep/${encodeURIComponent(v.drepId)}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') router.push(`/drep/${encodeURIComponent(v.drepId)}`);
                }}
                className={`border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer group ${isMyDrep ? 'ring-1 ring-primary/40 bg-primary/5' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {v.alignments && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <GovernanceRadar
                                  alignments={{
                                    treasuryConservative: v.alignments.treasuryConservative,
                                    treasuryGrowth: v.alignments.treasuryGrowth,
                                    decentralization: v.alignments.decentralization,
                                    security: v.alignments.security,
                                    innovation: v.alignments.innovation,
                                    transparency: v.alignments.transparency,
                                  }}
                                  size="mini"
                                />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[280px]">
                              <p className="text-xs">
                                Governance alignment radar — shows voting alignment across 6
                                dimensions: Treasury Conservative, Treasury Growth,
                                Decentralization, Security, Innovation, Transparency
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Badge
                        variant={
                          v.vote === 'Yes'
                            ? 'default'
                            : v.vote === 'No'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className="shrink-0"
                      >
                        {v.vote}
                      </Badge>
                      {v.drepName ? (
                        <span className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                          {v.drepName}
                        </span>
                      ) : (
                        <CopyableAddress
                          address={v.drepId}
                          truncate
                          className="text-sm font-medium text-muted-foreground"
                        />
                      )}
                      {isMyDrep && (
                        <Badge
                          variant="outline"
                          className="text-xs gap-1 bg-primary/10 border-primary/30"
                        >
                          <UserCheck className="h-2.5 w-2.5" />
                          Your DRep
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {new Date(v.blockTime * 1000).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>

                    {/* Rationale AI summary with hash verification + expandable full text */}
                    {(v.rationaleAiSummary || v.rationaleText) && (
                      <div className="bg-muted/30 rounded p-2 mt-2">
                        <div className="flex items-start gap-1.5">
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-xs text-foreground/80 ${expandedRationale === v.voteTxHash ? '' : 'line-clamp-2'}`}
                            >
                              <span className="font-semibold text-muted-foreground">
                                {expandedRationale === v.voteTxHash && v.rationaleText
                                  ? 'Full Rationale: '
                                  : 'Rationale: '}
                              </span>
                              {expandedRationale === v.voteTxHash && v.rationaleText
                                ? v.rationaleText
                                : v.rationaleAiSummary || v.rationaleText}
                            </p>
                            {v.rationaleText && v.rationaleText.length > 100 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedRationale(
                                    expandedRationale === v.voteTxHash ? null : v.voteTxHash,
                                  );
                                }}
                                className="text-[10px] text-primary hover:underline mt-1 font-medium"
                              >
                                {expandedRationale === v.voteTxHash
                                  ? 'Show summary'
                                  : 'Read full rationale'}
                              </button>
                            )}
                          </div>
                          {v.hashVerified === true && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <ShieldCheck className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">On-chain hash verified</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {v.hashVerified === false && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    Content doesn&apos;t match on-chain hash commitment
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                    )}

                    {v.metaUrl && !v.rationaleAiSummary && !v.rationaleText && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Rationale submitted but not yet indexed. Check back soon.
                      </p>
                    )}
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length > 20 && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowAll(!showAll)} className="w-full">
              {showAll ? (
                <>
                  Show less <ChevronUp className="h-4 w-4 ml-2" />
                </>
              ) : (
                <>
                  Show all {filtered.length} voters <ChevronDown className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}

        {filtered.length === 0 && (
          <EmptyState
            icon="search"
            title="No votes here yet"
            message="No votes match the current filter. Try selecting a different vote type to see how DReps weighed in."
            action={
              filter !== 'all'
                ? { label: 'Show All Votes', onClick: () => setFilter('all') }
                : undefined
            }
            compact
            component="ProposalVotersClient"
          />
        )}
      </CardContent>
    </Card>
  );
}
