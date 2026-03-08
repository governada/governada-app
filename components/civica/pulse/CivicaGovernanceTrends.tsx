'use client';

import { scaleLinear } from 'd3-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useGovernanceSparklines,
  useGovernanceHealthIndex,
  useGovernanceLeaderboard,
} from '@/hooks/queries';
import { tierKey, TIER_SCORE_COLOR, TIER_BADGE_BG } from '@/components/civica/cards/tierStyles';
import { computeTier } from '@/lib/scoring/tiers';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GovernanceHealthGauge } from '@/components/civica/charts/GovernanceHealthGauge';
import { ActivityHeatmap } from '@/components/civica/charts/ActivityHeatmap';

type SparkRow = { epoch: number; participation_rate: number; rationale_rate: number };

function TrendLine({
  data,
  color,
  height = 56,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  if (data.length < 2) return <div style={{ height }} className="w-full" />;
  const W = 400;
  const PAD = 3;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const xScale = scaleLinear()
    .domain([0, data.length - 1])
    .range([PAD, W - PAD]);
  const yScale = scaleLinear()
    .domain([min - range * 0.1, max + range * 0.1])
    .range([height - PAD, PAD]);
  const pts = data.map((v, i) => `${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`).join(' ');
  const areaBottom = height - PAD;
  const areaPts = `${xScale(0).toFixed(1)},${areaBottom} ${pts} ${xScale(data.length - 1).toFixed(1)},${areaBottom}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      <polygon points={areaPts} fill={color} opacity="0.12" />
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

function DualLine({ rows, height = 80 }: { rows: SparkRow[]; height?: number }) {
  if (rows.length < 2) return <div style={{ height }} className="w-full" />;
  const W = 400;
  const PAD = 3;
  const xScale = scaleLinear()
    .domain([0, rows.length - 1])
    .range([PAD, W - PAD]);
  const yScale = scaleLinear()
    .domain([0, 100])
    .range([height - PAD, PAD]);

  const pPts = rows
    .map((r, i) => `${xScale(i).toFixed(1)},${yScale(r.participation_rate).toFixed(1)}`)
    .join(' ');
  const rPts = rows
    .map((r, i) => `${xScale(i).toFixed(1)},${yScale(r.rationale_rate).toFixed(1)}`)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      <polyline fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" points={pPts} />
      <polyline
        fill="none"
        stroke="#34d399"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeDasharray="4 2"
        points={rPts}
      />
    </svg>
  );
}

const TIER_ORDER = ['Legendary', 'Diamond', 'Gold', 'Silver', 'Bronze', 'Emerging'] as const;

function TierDistribution({ dreps }: { dreps: Record<string, unknown>[] }) {
  const counts: Record<string, number> = {};
  for (const d of dreps) {
    const score = (d.drepScore as number) ?? (d.score as number) ?? 0;
    const tier = tierKey(computeTier(score));
    counts[tier] = (counts[tier] ?? 0) + 1;
  }
  const total = dreps.length || 1;

  return (
    <div className="space-y-2">
      {TIER_ORDER.map((tier) => {
        const count = counts[tier] ?? 0;
        const pct = (count / total) * 100;
        return (
          <div key={tier} className="flex items-center gap-2">
            <span className={cn('text-[11px] font-medium w-20 shrink-0', TIER_SCORE_COLOR[tier])}>
              {tier}
            </span>
            <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full', TIER_BADGE_BG[tier])}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground w-8 text-right">
              {count}
            </span>
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground pt-1">
        Sample of {dreps.length} DReps from leaderboard
      </p>
    </div>
  );
}

export function CivicaGovernanceTrends() {
  const { data: rawSparklines, isLoading: sparklinesLoading } = useGovernanceSparklines();
  const { data: rawGhi, isLoading: ghiLoading } = useGovernanceHealthIndex(20);
  const { data: rawLeaderboard } = useGovernanceLeaderboard();

  const sparklines = rawSparklines as Record<string, unknown> | undefined;
  const ghi = rawGhi as
    | {
        current?: { score?: number; band?: string };
        history?: { epoch: number; score: number; band: string }[];
        trend?: { direction?: string; delta?: number; streakEpochs?: number };
        [key: string]: unknown;
      }
    | undefined;
  const leaderboard = rawLeaderboard as
    | {
        dreps?: Record<string, unknown>[];
        rankings?: Record<string, unknown>[];
        weeklyMovers?: { gainers?: unknown[]; losers?: unknown[] };
        [key: string]: unknown;
      }
    | undefined;

  const participationRows: SparkRow[] = (sparklines?.participation as SparkRow[]) ?? [];
  const ghiHistory: { epoch: number; score: number; band: string }[] = ghi?.history ?? [];
  const trend = ghi?.trend;
  const dreps: Record<string, unknown>[] = (leaderboard?.dreps ??
    leaderboard?.rankings ??
    []) as Record<string, unknown>[];

  const participationValues = participationRows.map((r) => r.participation_rate);
  const rationaleValues = participationRows.map((r) => r.rationale_rate);
  const ghiValues = ghiHistory.map((h) => h.score);

  const isLoading = sparklinesLoading || ghiLoading;

  // Build a human-readable narrative for the GHI gauge
  const ghiNarrative = (() => {
    if (!trend?.delta || trend.delta === 0) return undefined;
    const dir = trend.delta > 0 ? 'Improving' : 'Declining';
    const abs = Math.abs(trend.delta).toFixed(1);
    const streak = (trend.streakEpochs ?? 0) > 1 ? ` over ${trend.streakEpochs} epochs` : '';
    return `${dir}: ${trend.delta > 0 ? '+' : '-'}${abs} pts${streak}`;
  })();

  const TrendIcon =
    trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend?.direction === 'up'
      ? 'text-emerald-400'
      : trend?.direction === 'down'
        ? 'text-rose-400'
        : 'text-muted-foreground';

  return (
    <div className="space-y-6">
      {/* Participation + rationale dual-line */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Participation & Rationale Rate</p>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-4 rounded-full bg-blue-400" />
              Participation
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-4 rounded-full bg-emerald-400 opacity-70" />
              Rationale
            </span>
          </div>
        </div>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : participationRows.length > 1 ? (
          <>
            <DualLine rows={participationRows} height={80} />
            <div className="flex gap-4 text-xs text-muted-foreground">
              {participationValues.length > 0 && (
                <span>
                  Latest participation:{' '}
                  <strong className="text-blue-400">
                    {participationValues[participationValues.length - 1]?.toFixed(1)}%
                  </strong>
                </span>
              )}
              {rationaleValues.length > 0 && (
                <span>
                  Rationale:{' '}
                  <strong className="text-emerald-400">
                    {rationaleValues[rationaleValues.length - 1]?.toFixed(1)}%
                  </strong>
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No trend data available yet.</p>
        )}
      </div>

      {/* GHI gauge + sparkline */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <p className="text-sm font-semibold">Governance Health Index</p>

        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            {/* Gauge */}
            {ghi?.current?.score != null && (
              <GovernanceHealthGauge
                score={ghi.current.score}
                band={ghi.current.band ?? 'Unknown'}
                delta={trend?.delta ?? undefined}
                narrative={ghiNarrative}
              />
            )}

            {/* Sparkline trend */}
            <div className="space-y-2">
              {ghiValues.length > 1 ? (
                <>
                  <TrendLine data={ghiValues} color="#818cf8" height={72} />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Ep {ghiHistory[0]?.epoch}</span>
                    {trend && (
                      <span className={cn('font-medium', trendColor)}>
                        <TrendIcon className="h-3 w-3 inline mr-0.5" />
                        {(trend.delta ?? 0) > 0 ? '+' : ''}
                        {trend.delta ?? 0}
                        {(trend.streakEpochs ?? 0) > 1 && ` (${trend.streakEpochs}ep)`}
                      </span>
                    )}
                    <span>Ep {ghiHistory[ghiHistory.length - 1]?.epoch}</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No GHI history available yet.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tier distribution */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <p className="text-sm font-semibold">DRep Tier Distribution</p>
        {dreps.length > 0 ? (
          <TierDistribution dreps={dreps} />
        ) : (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-2 w-20" />
                <Skeleton className="h-2 flex-1" />
                <Skeleton className="h-2 w-6" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Participation heatmap */}
      {participationRows.length > 4 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-sm font-semibold">Participation Activity</p>
          <p className="text-xs text-muted-foreground">
            Epoch-by-epoch DRep participation rate — darker = higher engagement.
          </p>
          <ActivityHeatmap
            data={participationRows.map((r) => ({
              epoch: r.epoch,
              value: r.participation_rate,
            }))}
            valueLabel="participation"
          />
        </div>
      )}

      {/* Rising vs falling */}
      {leaderboard?.weeklyMovers && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-4 text-center space-y-1">
            <TrendingUp className="h-5 w-5 text-emerald-400 mx-auto" />
            <p className="font-display text-2xl font-bold text-emerald-400 tabular-nums">
              {(leaderboard.weeklyMovers.gainers as unknown[] | undefined)?.length ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Rising DReps
            </p>
          </div>
          <div className="rounded-xl border border-rose-900/30 bg-rose-950/10 p-4 text-center space-y-1">
            <TrendingDown className="h-5 w-5 text-rose-400 mx-auto" />
            <p className="font-display text-2xl font-bold text-rose-400 tabular-nums">
              {(leaderboard.weeklyMovers.losers as unknown[] | undefined)?.length ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Falling DReps
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
