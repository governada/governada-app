'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { scaleLinear, scalePoint } from 'd3-scale';
import { line as d3line, curveMonotoneX } from 'd3-shape';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HexScore } from '@/components/HexScore';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import { ShareActions } from '@/components/ShareActions';
import { useWallet } from '@/utils/wallet';
import { extractAlignments, type AlignmentScores } from '@/lib/drepIdentity';
import { useChartDimensions } from '@/lib/charts/useChartDimensions';
import { GlowFilter } from '@/lib/charts/GlowDefs';
import { chartTheme } from '@/lib/charts/theme';
import {
  ArrowLeft,
  GitCompareArrows,
  ExternalLink,
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';

const DREP_COLORS = ['#6366f1', '#f59e0b', '#10b981'];
const DREP_COLOR_CLASSES = [
  'text-indigo-500',
  'text-amber-500',
  'text-emerald-500',
];

interface CompareProfile {
  drepId: string;
  name: string | null;
  ticker: string | null;
  isActive: boolean;
  sizeTier: string;
  votingPower: number;
  delegatorCount: number;
  drepScore: number;
  pillars: {
    effectiveParticipation: number;
    rationaleRate: number;
    reliabilityScore: number;
    profileCompleteness: number;
  };
}

interface DisagreementDetail {
  txHash: string;
  proposalIndex: number;
  title: string | null;
  proposalType: string | null;
  blockTime: number;
  votes: Record<string, 'Yes' | 'No' | 'Abstain'>;
  rationales: Record<string, string | null>;
}

interface PairwiseOverlap {
  pair: [string, string];
  sharedVotes: number;
  agreedCount: number;
  agreedPct: number;
  disagreements: DisagreementDetail[];
  abstentionGaps: { drepId: string; count: number }[];
}

interface AlignmentResult {
  overall: number;
  breakdown: { key: string; label: string; score: number }[];
}

interface ScoreSnapshot {
  date: string;
  score: number;
  effectiveParticipation: number;
  rationaleRate: number;
  reliabilityScore: number;
  profileCompleteness: number;
}

interface CompareData {
  dreps: CompareProfile[];
  scoreHistory: Record<string, ScoreSnapshot[]>;
  voteOverlap: PairwiseOverlap[];
  alignment: Record<string, AlignmentResult> | null;
}

interface CompareViewProps {
  initialDrepIds: string[];
}

const SIZE_TIER_COLORS: Record<string, string> = {
  Small: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Large: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Whale: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const VOTE_COLORS: Record<string, string> = {
  Yes: 'text-green-600 dark:text-green-400',
  No: 'text-red-600 dark:text-red-400',
  Abstain: 'text-amber-600 dark:text-amber-400',
};

function formatAda(lovelace: number): string {
  if (lovelace >= 1_000_000) return `${(lovelace / 1_000_000).toFixed(1)}M`;
  if (lovelace >= 1_000) return `${(lovelace / 1_000).toFixed(0)}K`;
  return lovelace.toLocaleString();
}

function formatDate(blockTime: number): string {
  return new Date(blockTime * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function CompareView({ initialDrepIds }: CompareViewProps) {
  const router = useRouter();
  const { delegatedDrepId, connected } = useWallet();
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllDisagreements, setShowAllDisagreements] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Check if this comparison is saved
  useEffect(() => {
    if (initialDrepIds.length < 2) return;
    try {
      const saved: string[][] = JSON.parse(localStorage.getItem('drepscore_saved_comparisons') || '[]');
      const key = [...initialDrepIds].sort().join(',');
      setIsSaved(saved.some(s => [...s].sort().join(',') === key));
    } catch { /* ignore */ }
  }, [initialDrepIds]);

  const handleSaveComparison = useCallback(() => {
    try {
      const saved: string[][] = JSON.parse(localStorage.getItem('drepscore_saved_comparisons') || '[]');
      const key = [...initialDrepIds].sort().join(',');
      const existing = saved.findIndex(s => [...s].sort().join(',') === key);
      if (existing >= 0) {
        saved.splice(existing, 1);
        setIsSaved(false);
      } else {
        saved.unshift(initialDrepIds);
        if (saved.length > 10) saved.pop();
        setIsSaved(true);
      }
      localStorage.setItem('drepscore_saved_comparisons', JSON.stringify(saved));
    } catch { /* ignore */ }
  }, [initialDrepIds]);

  const userPrefs = useMemo(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('drepscore_prefs');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.userPrefs || [];
      }
    } catch { /* ignore */ }
    return [];
  }, []);

  const fetchData = useCallback(async (ids: string[]) => {
    if (ids.length < 2) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ dreps: ids.join(',') });
      if (userPrefs.length > 0) {
        params.set('prefs', userPrefs.join(','));
      }
      const res = await fetch(`/api/compare?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load comparison');
      }
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [userPrefs]);

  useEffect(() => {
    if (initialDrepIds.length >= 2) {
      fetchData(initialDrepIds);
    } else {
      setLoading(false);
    }
  }, [initialDrepIds, fetchData]);

  const handleCompareWithYourDrep = useCallback(() => {
    if (!delegatedDrepId || !data?.dreps[0]) return;
    const currentIds = data.dreps.map(d => d.drepId);
    if (currentIds.includes(delegatedDrepId)) return;
    const newIds = [delegatedDrepId, ...currentIds.slice(0, 2)];
    router.push(`/compare?dreps=${newIds.join(',')}`);
  }, [delegatedDrepId, data, router]);

  const compareShareText = data
    ? `Comparing ${data.dreps.map(d => d.name || d.drepId.slice(0, 12)).join(' vs ')}: ${data.dreps.map(d => d.drepScore).join(' vs ')} on DRepScore. Who would you delegate to?`
    : '';
  const compareShareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const compareOgUrl = data ? `/api/og/compare?dreps=${data.dreps.map(d => d.drepId).join(',')}` : '';

  const drepAlignments = useMemo(() => {
    if (!data) return new Map<string, AlignmentScores>();
    const map = new Map<string, AlignmentScores>();
    for (const d of data.dreps) {
      map.set(d.drepId, extractAlignments(d as unknown as Record<string, unknown>));
    }
    return map;
  }, [data]);

  // Score history merged for multi-line chart
  const trendData = useMemo(() => {
    if (!data) return [];
    const dateMap = new Map<string, Record<string, unknown>>();
    for (const [drepId, snapshots] of Object.entries(data.scoreHistory)) {
      const last30 = snapshots.slice(-30);
      for (const s of last30) {
        const entry = dateMap.get(s.date) || { date: s.date };
        entry[drepId] = s.score;
        dateMap.set(s.date, entry);
      }
    }
    return [...dateMap.values()].sort((a, b) =>
      (a.date as string).localeCompare(b.date as string)
    );
  }, [data]);

  if (loading) return <CompareSkeleton />;
  if (error) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="h-10 w-10 mx-auto text-amber-500 mb-3" />
        <h2 className="text-lg font-bold mb-1">Comparison Failed</h2>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Link href="/">
          <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Back to DReps</Button>
        </Link>
      </div>
    );
  }
  if (!data || data.dreps.length < 2) {
    return (
      <div className="text-center py-16">
        <GitCompareArrows className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-lg font-bold mb-1">Select DReps to Compare</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Choose 2-3 DReps from the main table to compare them side by side.
        </p>
        <Link href="/">
          <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Browse DReps</Button>
        </Link>
      </div>
    );
  }

  const showCompareWithYours = connected && delegatedDrepId && !data.dreps.some(d => d.drepId === delegatedDrepId);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Compare DReps</h1>
              <p className="text-xs text-muted-foreground">
                Side-by-side comparison of scores, voting records, and alignment
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showCompareWithYours && (
              <Button variant="outline" size="sm" onClick={handleCompareWithYourDrep} className="text-xs">
                <GitCompareArrows className="h-3.5 w-3.5 mr-1.5" />
                Compare with Your DRep
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSaveComparison} className="text-xs">
              {isSaved ? <BookmarkCheck className="h-3.5 w-3.5 mr-1.5" /> : <Bookmark className="h-3.5 w-3.5 mr-1.5" />}
              {isSaved ? 'Saved' : 'Save'}
            </Button>
            <ShareActions
              url={compareShareUrl}
              text={compareShareText}
              imageUrl={compareOgUrl}
              surface="compare"
              variant="compact"
            />
          </div>
        </div>

        {/* DRep Header Cards */}
        <div className={`grid gap-4 ${data.dreps.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
          {data.dreps.map((drep, i) => (
            <Card key={drep.drepId} className="relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: DREP_COLORS[i] }} />
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start gap-3">
                  <HexScore score={drep.drepScore} alignments={drepAlignments.get(drep.drepId) ?? { treasuryConservative: null, treasuryGrowth: null, decentralization: null, security: null, innovation: null, transparency: null }} size="card" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/drep/${drep.drepId}`} className="hover:underline">
                      <h3 className="font-bold text-sm truncate">
                        {drep.name || drep.drepId.slice(0, 16) + '…'}
                      </h3>
                    </Link>
                    {drep.ticker && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ${drep.ticker}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge variant={drep.isActive ? 'default' : 'secondary'} className="text-[10px]">
                        {drep.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${SIZE_TIER_COLORS[drep.sizeTier] || ''}`}>
                        {drep.sizeTier}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span>{formatAda(drep.votingPower)} ADA</span>
                      <span>{drep.delegatorCount} delegator{drep.delegatorCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Governance Radar - Alignment Comparison */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Governance Identity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6 items-center">
              <div className="w-full md:w-1/2 flex items-center justify-center">
                {data.dreps.length === 2 && drepAlignments.get(data.dreps[0].drepId) ? (
                  <GovernanceRadar
                    alignments={drepAlignments.get(data.dreps[0].drepId)!}
                    compareAlignments={drepAlignments.get(data.dreps[1].drepId)}
                    size="full"
                  />
                ) : (
                  <div className="flex gap-4">
                    {data.dreps.map((d) => (
                      <GovernanceRadar
                        key={d.drepId}
                        alignments={drepAlignments.get(d.drepId) ?? { treasuryConservative: null, treasuryGrowth: null, decentralization: null, security: null, innovation: null, transparency: null }}
                        size="medium"
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="w-full md:w-1/2 space-y-3">
                {['effectiveParticipation', 'rationaleRate', 'reliabilityScore', 'profileCompleteness'].map((pillarKey, pi) => {
                  const labels = ['Participation', 'Rationale', 'Reliability', 'Profile'];
                  return (
                    <div key={pillarKey}>
                      <div className="text-xs font-medium mb-1">{labels[pi]}</div>
                      <div className="space-y-1">
                        {data.dreps.map((d, i) => {
                          const val = d.pillars[pillarKey as keyof CompareProfile['pillars']];
                          return (
                            <div key={d.drepId} className="flex items-center gap-2">
                              <span className={`text-[10px] w-20 truncate ${DREP_COLOR_CLASSES[i]}`}>
                                {d.name || d.drepId.slice(0, 10)}
                              </span>
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${val}%`, backgroundColor: DREP_COLORS[i] }}
                                />
                              </div>
                              <span className="text-[10px] tabular-nums w-8 text-right font-medium">{val}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score Trend */}
        {trendData.length > 1 && (
          <CompareScoreTrend trendData={trendData} dreps={data.dreps} />
        )}

        {/* Voting Overlap */}
        {data.voteOverlap.map(overlap => {
          const [idA, idB] = overlap.pair;
          const nameA = data.dreps.find(d => d.drepId === idA)?.name || idA.slice(0, 12);
          const nameB = data.dreps.find(d => d.drepId === idB)?.name || idB.slice(0, 12);
          const colorA = DREP_COLORS[data.dreps.findIndex(d => d.drepId === idA)] || DREP_COLORS[0];
          const colorB = DREP_COLORS[data.dreps.findIndex(d => d.drepId === idB)] || DREP_COLORS[1];
          const disagreementsToShow = showAllDisagreements
            ? overlap.disagreements
            : overlap.disagreements.slice(0, 5);

          return (
            <Card key={`${idA}-${idB}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span style={{ color: colorA }}>{nameA}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span style={{ color: colorB }}>{nameB}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Agreement Hero Stat */}
                <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold tabular-nums" style={{
                    color: overlap.agreedPct >= 80 ? '#22c55e' : overlap.agreedPct >= 50 ? '#f59e0b' : '#ef4444'
                  }}>
                    {overlap.agreedPct}%
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Agreed on {overlap.agreedCount} of {overlap.sharedVotes} shared votes
                    </p>
                    {overlap.abstentionGaps.some(g => g.count > 0) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {overlap.abstentionGaps.filter(g => g.count > 0).map(g => {
                          const name = data.dreps.find(d => d.drepId === g.drepId)?.name || g.drepId.slice(0, 12);
                          return `${name} voted on ${g.count} proposals the other didn't`;
                        }).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Disagreement Table */}
                {overlap.disagreements.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                      Where They Disagree ({overlap.disagreements.length})
                    </h4>
                    <div className="space-y-2">
                      {disagreementsToShow.map(d => (
                        <div
                          key={`${d.txHash}-${d.proposalIndex}`}
                          className="border rounded-lg p-3 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/proposals/${d.txHash}/${d.proposalIndex}`}
                                className="text-xs font-medium hover:underline line-clamp-1"
                              >
                                {d.title || `${d.txHash.slice(0, 16)}…`}
                              </Link>
                              <div className="flex items-center gap-2 mt-0.5">
                                {d.proposalType && (
                                  <span className="text-[10px] text-muted-foreground">{d.proposalType}</span>
                                )}
                                <span className="text-[10px] text-muted-foreground">{formatDate(d.blockTime)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {[idA, idB].map((drepId, vi) => {
                              const vote = d.votes[drepId];
                              const rationale = d.rationales[drepId];
                              const name = vi === 0 ? nameA : nameB;
                              const color = vi === 0 ? colorA : colorB;
                              return (
                                <div key={drepId} className="text-xs space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium truncate" style={{ color }}>{name}</span>
                                    <Badge variant="outline" className={`text-[10px] ${VOTE_COLORS[vote]}`}>{vote}</Badge>
                                  </div>
                                  {rationale && (
                                    <p className="text-muted-foreground text-[10px] line-clamp-2">{rationale}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    {overlap.disagreements.length > 5 && !showAllDisagreements && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2 text-xs"
                        onClick={() => setShowAllDisagreements(true)}
                      >
                        Show all {overlap.disagreements.length} disagreements
                      </Button>
                    )}
                  </div>
                )}

                {overlap.disagreements.length === 0 && overlap.sharedVotes > 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No disagreements — they voted the same way on every shared proposal.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Alignment Comparison */}
        {data.alignment && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Alignment with Your Values</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Overall alignment bars */}
                <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  {data.dreps.map((d, i) => {
                    const a = data.alignment![d.drepId];
                    if (!a) return null;
                    return (
                      <div key={d.drepId} className="flex-1 text-center">
                        <p className="text-xs font-medium mb-1" style={{ color: DREP_COLORS[i] }}>
                          {d.name || d.drepId.slice(0, 12)}
                        </p>
                        <p className="text-2xl font-bold tabular-nums">{a.overall}%</p>
                        <p className="text-[10px] text-muted-foreground">match</p>
                      </div>
                    );
                  })}
                </div>
                {/* Per-category breakdown */}
                {data.alignment[data.dreps[0].drepId]?.breakdown.map(cat => (
                  <div key={cat.key}>
                    <div className="text-xs font-medium mb-1">{cat.label}</div>
                    <div className="space-y-1">
                      {data.dreps.map((d, i) => {
                        const score = data.alignment![d.drepId]?.breakdown.find(b => b.key === cat.key)?.score ?? 0;
                        return (
                          <div key={d.drepId} className="flex items-center gap-2">
                            <span className={`text-[10px] w-20 truncate ${DREP_COLOR_CLASSES[i]}`}>
                              {d.name || d.drepId.slice(0, 10)}
                            </span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${score}%`, backgroundColor: DREP_COLORS[i] }}
                              />
                            </div>
                            <span className="text-[10px] tabular-nums w-8 text-right font-medium">{score}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA Footer */}
        <div className="flex items-center justify-center gap-3 py-4">
          {data.dreps.map(d => (
            <Tooltip key={d.drepId}>
              <TooltipTrigger asChild>
                <Link href={`/drep/${d.drepId}`}>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5">
                    View {d.name || d.drepId.slice(0, 10)}
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>View full profile and delegate</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

function CompareScoreTrend({
  trendData,
  dreps,
}: {
  trendData: Record<string, unknown>[];
  dreps: CompareProfile[];
}) {
  const { containerRef, dimensions } = useChartDimensions(200);
  const { width, innerWidth, innerHeight, margin } = dimensions;

  const dates = useMemo(() => trendData.map((d) => d.date as string), [trendData]);

  const xScale = useMemo(
    () => scalePoint<string>().domain(dates).range([0, innerWidth]).padding(0.1),
    [dates, innerWidth],
  );

  const yScale = useMemo(
    () => scaleLinear().domain([0, 100]).range([innerHeight, 0]),
    [innerHeight],
  );

  const paths = useMemo(
    () =>
      dreps.map((d, i) => {
        const gen = d3line<Record<string, unknown>>()
          .defined((row) => row[d.drepId] != null)
          .x((row) => xScale(row.date as string) ?? 0)
          .y((row) => yScale(row[d.drepId] as number))
          .curve(curveMonotoneX);
        return { drepId: d.drepId, name: d.name || d.drepId.slice(0, 12), d: gen(trendData) ?? '', color: DREP_COLORS[i] };
      }),
    [dreps, trendData, xScale, yScale],
  );

  const ticks = yScale.ticks(4);
  const xTicks = dates.length <= 8 ? dates : dates.filter((_, i) => i % Math.ceil(dates.length / 6) === 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Score Trend (Last 30 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="w-full" style={{ height: 200 }}>
          {width > 0 && (
            <svg width={width} height={200}>
              <defs>
                {dreps.map((_, i) => (
                  <GlowFilter key={i} id={`compare-glow-${i}`} stdDeviation={2} />
                ))}
              </defs>
              <g transform={`translate(${margin.left},${margin.top})`}>
                {ticks.map((t) => (
                  <g key={t}>
                    <line x1={0} x2={innerWidth} y1={yScale(t)} y2={yScale(t)} stroke="currentColor" strokeWidth={0.5} strokeDasharray="4 4" className="text-border" />
                    <text x={-8} y={yScale(t)} textAnchor="end" dominantBaseline="central" fontSize={10} className="fill-muted-foreground">{t}</text>
                  </g>
                ))}
                {xTicks.map((date) => {
                  const d = new Date(date);
                  return (
                    <text key={date} x={xScale(date) ?? 0} y={innerHeight + 16} textAnchor="middle" fontSize={10} className="fill-muted-foreground">
                      {d.getMonth() + 1}/{d.getDate()}
                    </text>
                  );
                })}
                {paths.map((p, i) => (
                  <g key={p.drepId}>
                    <path d={p.d} fill="none" stroke={p.color} strokeWidth={2} filter={`url(#compare-glow-${i})`} opacity={0.3} />
                    <path d={p.d} fill="none" stroke={p.color} strokeWidth={2} strokeLinecap="round" />
                  </g>
                ))}
              </g>
            </svg>
          )}
        </div>
        <div className="flex gap-4 mt-2 justify-center">
          {paths.map((p) => (
            <div key={p.drepId} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-3 h-0.5 rounded" style={{ backgroundColor: p.color }} />
              {p.name}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CompareSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-[340px]" />
      <Skeleton className="h-[200px]" />
      <Skeleton className="h-[300px]" />
    </div>
  );
}
