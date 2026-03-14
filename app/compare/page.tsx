/**
 * DRep Compare Page — Side-by-side comparison of 2-3 DReps.
 * Reads `?dreps=id1,id2[,id3]` from search params.
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

import { getDRepById } from '@/lib/data';
import { getDRepPrimaryName } from '@/utils/display';
import { formatAda } from '@/utils/scoring';
import { extractAlignments, getDimensionLabel, getDimensionOrder } from '@/lib/drepIdentity';
import { computeTier } from '@/lib/scoring/tiers';
import type { TierName } from '@/lib/scoring/tiers';
import { cn } from '@/lib/utils';
import type { EnrichedDRep } from '@/lib/koios';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { HexScore } from '@/components/HexScore';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import { TierBadge } from '@/components/governada/cards/TierBadge';
import { DelegateButton } from '@/components/DelegateButton';
import { PageViewTracker } from '@/components/PageViewTracker';

interface ComparePageProps {
  searchParams: Promise<{ dreps?: string }>;
}

export async function generateMetadata({ searchParams }: ComparePageProps): Promise<Metadata> {
  const { dreps: drepsParam } = await searchParams;
  const ids = drepsParam?.split(',').filter(Boolean) ?? [];

  if (ids.length < 2) {
    return { title: 'Compare DReps — Governada' };
  }

  return {
    title: `Compare ${ids.length} DReps — Governada`,
    description:
      'Side-by-side comparison of DRep governance scores, alignment, and voting records.',
  };
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { dreps: drepsParam } = await searchParams;

  if (!drepsParam) {
    redirect('/governance');
  }

  const ids = drepsParam
    .split(',')
    .map((id) => decodeURIComponent(id.trim()))
    .filter(Boolean)
    .slice(0, 3);

  if (ids.length < 2) {
    redirect('/governance');
  }

  // Fetch all DReps in parallel
  const drepResults = await Promise.all(ids.map((id) => getDRepById(id)));

  // If any DRep ID is invalid, 404
  if (drepResults.some((d) => d === null)) {
    notFound();
  }

  const dreps = drepResults as EnrichedDRep[];
  const drepData = dreps.map((drep) => {
    const alignments = extractAlignments(drep);
    const tier = computeTier(drep.drepScore);
    const name = getDRepPrimaryName(drep);
    return { drep, alignments, tier, name };
  });

  const dimensions = getDimensionOrder();

  // 4-pillar data for comparison
  const pillarLabels = [
    { key: 'engagementQuality' as const, label: 'Engagement Quality', weight: '35%' },
    {
      key: 'effectiveParticipationV3' as const,
      label: 'Effective Participation',
      weight: '30%',
    },
    { key: 'reliabilityV3' as const, label: 'Reliability', weight: '20%' },
    { key: 'governanceIdentity' as const, label: 'Governance Identity', weight: '15%' },
  ];

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-6xl">
      <PageViewTracker event="compare_page_viewed" properties={{ drep_count: dreps.length }} />

      {/* Back button */}
      <Link href="/">
        <Button variant="ghost" className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back to DReps
        </Button>
      </Link>

      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compare DReps</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Side-by-side comparison of {dreps.length} governance representatives
        </p>
      </div>

      {/* ─── Hero: Names, HexScores, Tier Badges ─── */}
      <div
        className={cn(
          'grid gap-6',
          dreps.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3',
        )}
      >
        {drepData.map(({ drep, alignments, tier, name }) => (
          <Card key={drep.drepId} className="text-center">
            <CardContent className="pt-6 pb-4 flex flex-col items-center gap-3">
              <HexScore score={drep.drepScore} alignments={alignments} size="hero" />
              <div className="space-y-1">
                <Link
                  href={`/drep/${encodeURIComponent(drep.drepId)}`}
                  className="text-lg font-semibold hover:text-primary transition-colors block"
                >
                  {name}
                </Link>
                {drep.ticker && (
                  <span className="text-xs text-muted-foreground">${drep.ticker}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <TierBadge tier={tier as TierName} />
                <Badge variant={drep.isActive ? 'default' : 'secondary'}>
                  {drep.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <DelegateButton drepId={drep.drepId} drepName={name} size="sm" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── Key Stats Comparison ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Key Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <ComparisonTable
            rows={[
              {
                label: 'Governance Score',
                values: drepData.map(({ drep }) => `${drep.drepScore}/100`),
                highlight: true,
              },
              {
                label: 'Participation Rate',
                values: drepData.map(({ drep }) => `${drep.effectiveParticipation}%`),
              },
              {
                label: 'Rationale Rate',
                values: drepData.map(({ drep }) => `${drep.rationaleRate}%`),
              },
              {
                label: 'Delegators',
                values: drepData.map(({ drep }) => drep.delegatorCount.toLocaleString()),
              },
              {
                label: 'Voting Power',
                values: drepData.map(({ drep }) => `${formatAda(drep.votingPower)} ADA`),
              },
              {
                label: 'Total Votes',
                values: drepData.map(({ drep }) => drep.totalVotes.toLocaleString()),
              },
              {
                label: 'Yes / No / Abstain',
                values: drepData.map(
                  ({ drep }) => `${drep.yesVotes} / ${drep.noVotes} / ${drep.abstainVotes}`,
                ),
              },
              {
                label: 'Reliability',
                values: drepData.map(({ drep }) => `${drep.reliabilityScore}%`),
              },
              {
                label: 'Profile Completeness',
                values: drepData.map(({ drep }) => `${drep.profileCompleteness}%`),
              },
            ]}
            count={dreps.length}
          />
        </CardContent>
      </Card>

      {/* ─── 4-Pillar Breakdown ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score Pillars (V3)</CardTitle>
        </CardHeader>
        <CardContent>
          <ComparisonTable
            rows={pillarLabels.map(({ key, label, weight }) => ({
              label: `${label} (${weight})`,
              values: drepData.map(({ drep }) => {
                const val = drep[key];
                return val != null ? `${Math.round(val)}/100` : 'N/A';
              }),
            }))}
            count={dreps.length}
          />
        </CardContent>
      </Card>

      {/* ─── Alignment Radar Comparison ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Governance Alignment</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Side-by-side radars */}
          <div
            className={cn(
              'grid gap-6 mb-6',
              dreps.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3',
            )}
          >
            {drepData.map(({ drep, alignments, name }) => (
              <div key={drep.drepId} className="flex flex-col items-center gap-2">
                <span className="text-sm font-medium">{name}</span>
                <GovernanceRadar alignments={alignments} size="full" />
              </div>
            ))}
          </div>

          {/* Dimension-by-dimension table */}
          <ComparisonTable
            rows={dimensions.map((dim) => ({
              label: getDimensionLabel(dim),
              values: drepData.map(({ alignments }) => {
                const val = alignments[dim];
                return val != null ? `${Math.round(val)}` : '50';
              }),
            }))}
            count={dreps.length}
          />
        </CardContent>
      </Card>

      {/* ─── Voting Pattern Comparison ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voting Patterns</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              'grid gap-6',
              dreps.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3',
            )}
          >
            {drepData.map(({ drep, name }) => (
              <div key={drep.drepId} className="space-y-2">
                <span className="text-sm font-medium block text-center">{name}</span>
                <VotingPatternBar
                  total={drep.totalVotes}
                  yes={drep.yesVotes}
                  no={drep.noVotes}
                  abstain={drep.abstainVotes}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Delegate CTAs ─── */}
      <Card>
        <CardContent className="pt-6">
          <div
            className={cn(
              'grid gap-6',
              dreps.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3',
            )}
          >
            {drepData.map(({ drep, name }) => (
              <div key={drep.drepId} className="flex flex-col items-center gap-3 py-4">
                <span className="text-sm font-semibold">{name}</span>
                <span className="text-3xl font-bold tabular-nums">{drep.drepScore}</span>
                <DelegateButton drepId={drep.drepId} drepName={name} size="default" />
                <Link
                  href={`/drep/${encodeURIComponent(drep.drepId)}`}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  View full profile
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Helper Components ─── */

interface ComparisonRow {
  label: string;
  values: string[];
  highlight?: boolean;
}

function ComparisonTable({ rows, count }: { rows: ComparisonRow[]; count: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium w-1/4">
              Metric
            </th>
            {Array.from({ length: count }, (_, i) => (
              <th
                key={i}
                className="text-center py-2 px-2 text-xs text-muted-foreground font-medium"
              >
                DRep {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border/50 last:border-0">
              <td className="py-2.5 pr-4 text-xs text-muted-foreground">{row.label}</td>
              {row.values.map((val, i) => {
                const isHighest = isHighestValue(val, row.values);
                return (
                  <td
                    key={i}
                    className={cn(
                      'text-center py-2.5 px-2 tabular-nums font-mono text-sm',
                      row.highlight && 'font-semibold',
                      isHighest && row.values.length > 1 && 'text-primary font-medium',
                    )}
                  >
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VotingPatternBar({
  total,
  yes,
  no,
  abstain,
}: {
  total: number;
  yes: number;
  no: number;
  abstain: number;
}) {
  if (total === 0) {
    return <p className="text-xs text-muted-foreground text-center">No votes yet</p>;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-border">
        {yes > 0 && (
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${(yes / total) * 100}%` }}
            title={`Yes: ${yes}`}
          />
        )}
        {no > 0 && (
          <div
            className="h-full bg-rose-500"
            style={{ width: `${(no / total) * 100}%` }}
            title={`No: ${no}`}
          />
        )}
        {abstain > 0 && (
          <div
            className="h-full bg-muted-foreground/40"
            style={{ width: `${(abstain / total) * 100}%` }}
            title={`Abstain: ${abstain}`}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span className="text-emerald-500">{yes} Yes</span>
        <span className="text-rose-500">{no} No</span>
        <span>{abstain} Abstain</span>
      </div>
    </div>
  );
}

/** Determine if a value is the highest numeric value among peers (for highlighting). */
function isHighestValue(val: string, all: string[]): boolean {
  const numericValues = all.map((v) => {
    const match = v.match(/^([\d,.]+)/);
    if (!match) return null;
    return parseFloat(match[1].replace(/,/g, ''));
  });

  const thisNum = (() => {
    const match = val.match(/^([\d,.]+)/);
    if (!match) return null;
    return parseFloat(match[1].replace(/,/g, ''));
  })();

  if (thisNum === null) return false;
  const validNums = numericValues.filter((n): n is number => n !== null);
  if (validNums.length < 2) return false;

  const max = Math.max(...validNums);
  // Only highlight if there's a unique max and this value matches it
  const countAtMax = validNums.filter((n) => n === max).length;
  return countAtMax === 1 && thisNum === max;
}
