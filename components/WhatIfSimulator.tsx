'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useDReps } from '@/hooks/queries';
import { useWallet } from '@/utils/wallet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import { extractAlignments, type AlignmentScores } from '@/lib/drepIdentity';
import { Search, ArrowRight, User, UserPlus } from 'lucide-react';

interface DRepData {
  drepId: string;
  name: string | null;
  ticker: string | null;
  drepScore: number;
  effectiveParticipation: number;
  rationaleRate: number;
  alignments: AlignmentScores;
}

interface WhatIfSimulatorProps {
  currentDRepId?: string | null;
}

function toAlignments(row: Record<string, unknown>): AlignmentScores {
  return extractAlignments(row as Record<string, unknown>);
}

export function WhatIfSimulator({ currentDRepId: propCurrentDRepId }: WhatIfSimulatorProps) {
  const { delegatedDrepId } = useWallet();
  const currentDRepId = propCurrentDRepId ?? delegatedDrepId;

  const { data: drepsData, isLoading: loading } = useDReps();
  const dreps = useMemo<DRepData[]>(() => {
    const raw = drepsData as any;
    if (!raw) return [];
    const list = raw?.allDReps?.length ? raw.allDReps : (raw?.dreps || []);
    return list.map((d: Record<string, unknown>) => ({
      drepId: d.drepId as string,
      name: (d.name as string) ?? null,
      ticker: (d.ticker as string) ?? null,
      drepScore: (d.drepScore as number) ?? 0,
      effectiveParticipation: (d.effectiveParticipation as number) ?? 0,
      rationaleRate: (d.rationaleRate as number) ?? 0,
      alignments: toAlignments(d),
    }));
  }, [drepsData]);
  const [searchQuery, setSearchQuery] = useState('');
  const [compareDrep, setCompareDrep] = useState<DRepData | null>(null);

  const currentDrep = useMemo(
    () => (currentDRepId ? (dreps.find((d) => d.drepId === currentDRepId) ?? null) : null),
    [dreps, currentDRepId],
  );

  const filteredDreps = useMemo(() => {
    if (!searchQuery.trim()) return dreps.slice(0, 8);
    const q = searchQuery.toLowerCase().trim();
    return dreps
      .filter(
        (d) =>
          (d.name?.toLowerCase().includes(q) ||
            d.ticker?.toLowerCase().includes(q) ||
            d.drepId.toLowerCase().includes(q)) &&
          d.drepId !== currentDRepId,
      )
      .slice(0, 8);
  }, [dreps, searchQuery, currentDRepId]);

  const scoreDelta = useMemo(() => {
    if (!currentDrep || !compareDrep) return null;
    return compareDrep.drepScore - currentDrep.drepScore;
  }, [currentDrep, compareDrep]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2 border-green-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-green-500" />
              Current DRep
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <Skeleton className="h-32 w-full rounded-lg" />
            ) : currentDrep ? (
              <>
                <div>
                  <p className="font-semibold">
                    {currentDrep.name ||
                      currentDrep.ticker ||
                      currentDrep.drepId.slice(0, 16) + '…'}
                  </p>
                  <p className="text-3xl font-bold tabular-nums text-green-600 dark:text-green-400">
                    {Math.round(currentDrep.drepScore)}
                  </p>
                  <p className="text-xs text-muted-foreground">Score</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Participation: {Math.round(currentDrep.effectiveParticipation * 100)}%
                  </p>
                </div>
                <GovernanceRadar
                  alignments={currentDrep.alignments}
                  size="medium"
                  animate={false}
                />
                <Link href={`/drep/${encodeURIComponent(currentDrep.drepId)}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    View profile <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {currentDRepId
                    ? 'DRep not found in list'
                    : 'Connect your wallet to see your current delegation'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-dashed border-muted-foreground/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" />
              Compare with
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search DRep by name, ticker, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {compareDrep ? (
              <>
                <div>
                  <p className="font-semibold">
                    {compareDrep.name ||
                      compareDrep.ticker ||
                      compareDrep.drepId.slice(0, 16) + '…'}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold tabular-nums">
                      {Math.round(compareDrep.drepScore)}
                    </p>
                    {scoreDelta !== null && (
                      <span
                        className={`text-sm font-medium ${
                          scoreDelta > 0
                            ? 'text-green-600'
                            : scoreDelta < 0
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {scoreDelta > 0 ? '+' : ''}
                        {scoreDelta} vs current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Score</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Participation: {Math.round(compareDrep.effectiveParticipation * 100)}%
                  </p>
                </div>
                <GovernanceRadar
                  alignments={compareDrep.alignments}
                  compareAlignments={currentDrep?.alignments}
                  size="medium"
                  animate={false}
                />
                <Link href={`/drep/${encodeURIComponent(compareDrep.drepId)}`}>
                  <Button className="w-full">
                    Delegate to this DRep <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setCompareDrep(null)}
                >
                  Clear selection
                </Button>
              </>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {filteredDreps.map((d) => (
                  <button
                    key={d.drepId}
                    type="button"
                    onClick={() => setCompareDrep(d)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium truncate">
                        {d.name || d.ticker || d.drepId.slice(0, 12) + '…'}
                      </span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {Math.round(d.drepScore)}
                      </span>
                    </div>
                  </button>
                ))}
                {filteredDreps.length === 0 && searchQuery && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No DReps match &quot;{searchQuery}&quot;
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
