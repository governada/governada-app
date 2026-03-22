'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, Download, ExternalLink, Info } from 'lucide-react';
import { useGovernanceHealthIndex } from '@/hooks/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { GHI_BAND_COLORS } from '@/lib/ghi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HistoryEntry {
  epoch: number;
  score: number;
  band: string;
  components: { name: string; value: number; weight: number; contribution: number }[] | null;
}

interface TrendData {
  direction: 'up' | 'down' | 'flat';
  delta: number;
  streakEpochs: number;
}

interface ComponentTrend {
  direction: string;
  delta: number;
}

// ---------------------------------------------------------------------------
// Sparkline SVG
// ---------------------------------------------------------------------------

function Sparkline({
  data,
  width = 600,
  height = 120,
  bandColor,
}: {
  data: number[];
  width?: number;
  height?: number;
  bandColor: string;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data) - 5;
  const max = Math.max(...data) + 5;
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });

  const areaPoints = [...points, `${width},${height}`, `0,${height}`];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bandColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={bandColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints.join(' ')} fill="url(#sparkGradient)" />
      <polyline points={points.join(' ')} fill="none" stroke={bandColor} strokeWidth="2" />
      {/* Current value dot */}
      {data.length > 0 && (
        <circle
          cx={width}
          cy={height - ((data[data.length - 1] - min) / range) * height}
          r="4"
          fill={bandColor}
        />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component sparkline (mini)
// ---------------------------------------------------------------------------

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div className="h-6 w-20" />;

  const min = Math.min(...data) - 2;
  const max = Math.max(...data) + 2;
  const range = max - min || 1;
  const w = 80;
  const h = 24;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-6 w-20" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Trend indicator
// ---------------------------------------------------------------------------

function TrendIndicator({ trend }: { trend: TrendData }) {
  const Icon =
    trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
  const color =
    trend.direction === 'up'
      ? 'text-emerald-400'
      : trend.direction === 'down'
        ? 'text-red-400'
        : 'text-white/40';
  const sign = trend.delta > 0 ? '+' : '';

  return (
    <div className={`flex items-center gap-1.5 ${color}`}>
      <Icon className="h-5 w-5" />
      <span className="text-lg font-medium">
        {sign}
        {trend.delta}
      </span>
      {trend.streakEpochs > 0 && (
        <span className="text-xs text-white/40">({trend.streakEpochs} epoch streak)</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data export
// ---------------------------------------------------------------------------

function downloadCSV(history: HistoryEntry[], current: { score: number; band: string }) {
  const headers = ['epoch', 'score', 'band'];
  const rows = [
    ...history.map((h) => [h.epoch, h.score, h.band].join(',')),
    ['current', current.score, current.band].join(','),
  ];
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ghi-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON(data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ghi-history-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NorthStarTracker() {
  const { data: rawData, isLoading, error } = useGovernanceHealthIndex(50);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API response is untyped from fetchJson
  const data = rawData as Record<string, any> | undefined;

  const dataCurrent = data?.current;
  const dataHistory = data?.history;
  const dataTrend = data?.trend;
  const dataComponentTrends = data?.componentTrends;

  const { current, history, trend, componentTrends, componentHistories } = useMemo(() => {
    if (!dataCurrent)
      return {
        current: null,
        history: [] as HistoryEntry[],
        trend: null as TrendData | null,
        componentTrends: {} as Record<string, ComponentTrend>,
        componentHistories: {} as Record<string, number[]>,
      };

    const hist = (dataHistory as HistoryEntry[]) ?? [];
    const reversed = [...hist].reverse(); // oldest first for sparkline

    // Build per-component history from snapshots
    const compHist: Record<string, number[]> = {};
    for (const entry of reversed) {
      if (!entry.components) continue;
      for (const comp of entry.components) {
        if (!compHist[comp.name]) compHist[comp.name] = [];
        compHist[comp.name].push(comp.value);
      }
    }
    // Add current values
    const currentComps = dataCurrent.components as { name: string; value: number }[] | undefined;
    if (currentComps) {
      for (const comp of currentComps) {
        if (!compHist[comp.name]) compHist[comp.name] = [];
        compHist[comp.name].push(comp.value);
      }
    }

    return {
      current: dataCurrent as {
        score: number;
        band: string;
        components: { name: string; value: number; weight: number; contribution: number }[];
      } | null,
      history: hist,
      trend: (dataTrend as TrendData) ?? null,
      componentTrends: (dataComponentTrends as Record<string, ComponentTrend>) ?? {},
      componentHistories: compHist,
    };
  }, [dataCurrent, dataHistory, dataTrend, dataComponentTrends]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6 text-center text-red-400">
        Failed to load GHI data. Please try again later.
      </div>
    );
  }

  const bandColor = current
    ? (GHI_BAND_COLORS[current.band as keyof typeof GHI_BAND_COLORS] ?? '#06b6d4')
    : '#06b6d4';
  const scoreHistory =
    history.length > 0 ? [...[...history].reverse().map((h) => h.score), current?.score ?? 0] : [];

  return (
    <TooltipProvider>
      <div className="space-y-8">
        {/* Header */}
        <header>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Governance Health Index</h1>
              <p className="mt-1 text-sm text-white/50">
                Governada&apos;s North Star metric — tracking whether Cardano&apos;s governance is
                improving over time
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/governance/health/methodology"
                className="flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-1.5 text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
              >
                <Info className="h-3.5 w-3.5" />
                Methodology
              </Link>
            </div>
          </div>
        </header>

        {/* Hero score */}
        {isLoading ? (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8">
            <Skeleton className="mx-auto h-20 w-32" />
            <Skeleton className="mx-auto mt-4 h-6 w-48" />
          </div>
        ) : current ? (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
              {/* Score */}
              <div className="text-center sm:text-left">
                <div className="flex items-baseline gap-3">
                  <span className="text-6xl font-bold tabular-nums" style={{ color: bandColor }}>
                    {current.score}
                  </span>
                  <span className="text-lg font-medium capitalize text-white/50">
                    {current.band}
                  </span>
                </div>
                {trend && <TrendIndicator trend={trend} />}
              </div>

              {/* Sparkline */}
              <div className="w-full max-w-md">
                <Sparkline data={scoreHistory} bandColor={bandColor} />
                <div className="mt-1 flex justify-between text-xs text-white/30">
                  <span>Epoch {history[history.length - 1]?.epoch ?? '—'}</span>
                  <span>Current</span>
                </div>
              </div>
            </div>

            {/* Mission statement */}
            <div className="mt-6 border-t border-white/5 pt-4">
              <p className="text-sm text-white/40">
                GHI measures how well Cardano&apos;s governance mechanisms are functioning.
                Governada&apos;s mission is to make governance health visible, measurable, and
                improvable. We succeed when this number trends up — not because we control it, but
                because transparency drives accountability.
              </p>
            </div>
          </div>
        ) : null}

        {/* Component breakdown */}
        {current && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-white">Component Breakdown</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {current.components
                .filter((c) => c.weight > 0)
                .map((comp) => {
                  const ct = componentTrends[comp.name];
                  const ch = componentHistories[comp.name] ?? [];
                  const compColor =
                    comp.value >= 76
                      ? '#10b981'
                      : comp.value >= 51
                        ? '#06b6d4'
                        : comp.value >= 26
                          ? '#f59e0b'
                          : '#ef4444';

                  return (
                    <div
                      key={comp.name}
                      className="rounded-lg border border-white/5 bg-white/[0.02] p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white/80">{comp.name}</p>
                          <div className="mt-1 flex items-baseline gap-2">
                            <span
                              className="text-2xl font-bold tabular-nums"
                              style={{ color: compColor }}
                            >
                              {comp.value}
                            </span>
                            <span className="text-xs text-white/30">
                              {Math.round(comp.weight * 100)}% weight
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <MiniSparkline data={ch} color={compColor} />
                          {ct && ct.direction !== 'flat' && (
                            <span
                              className={`text-xs ${ct.direction === 'up' ? 'text-emerald-400' : 'text-red-400'}`}
                            >
                              {ct.delta > 0 ? '+' : ''}
                              {ct.delta}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Contribution bar */}
                      <div className="mt-2">
                        <div className="h-1 rounded-full bg-white/5">
                          <div
                            className="h-1 rounded-full transition-all"
                            style={{
                              width: `${comp.value}%`,
                              backgroundColor: compColor,
                              opacity: 0.6,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {/* Epoch history table */}
        {history.length > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Epoch History</h2>
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => current && downloadCSV(history, current)}
                      className="flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-1.5 text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
                    >
                      <Download className="h-3.5 w-3.5" />
                      CSV
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Download GHI history as CSV</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => downloadJSON(data)}
                      className="flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-1.5 text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
                    >
                      <Download className="h-3.5 w-3.5" />
                      JSON
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Download full GHI data as JSON</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-white/40">
                    <th className="px-4 py-2">Epoch</th>
                    <th className="px-4 py-2">Score</th>
                    <th className="px-4 py-2">Band</th>
                    <th className="px-4 py-2">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 20).map((entry, i) => {
                    const prev = history[i + 1];
                    const delta = prev ? entry.score - prev.score : 0;
                    const entryColor =
                      GHI_BAND_COLORS[entry.band as keyof typeof GHI_BAND_COLORS] ?? '#06b6d4';

                    return (
                      <tr
                        key={entry.epoch}
                        className="border-b border-white/5 hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-2 text-white/60">{entry.epoch}</td>
                        <td
                          className="px-4 py-2 font-mono font-medium"
                          style={{ color: entryColor }}
                        >
                          {entry.score}
                        </td>
                        <td className="px-4 py-2 capitalize text-white/50">{entry.band}</td>
                        <td className="px-4 py-2">
                          {delta !== 0 && (
                            <span className={delta > 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {delta > 0 ? '+' : ''}
                              {delta}
                            </span>
                          )}
                          {delta === 0 && <span className="text-white/20">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Embed callout */}
        <section className="rounded-lg border border-white/5 bg-white/[0.02] p-6">
          <h2 className="mb-2 text-base font-medium text-white/80">Embed GHI on your site</h2>
          <p className="mb-3 text-sm text-white/50">
            Share the Governance Health Index on your DRep campaign page, forum post, or community
            site. The embed auto-updates with the latest GHI score.
          </p>
          <div className="rounded border border-white/10 bg-black/30 p-3">
            <code className="break-all text-xs text-cyan-400/70">
              {`<iframe src="https://governada.io/embed/ghi" width="320" height="200" frameborder="0"></iframe>`}
            </code>
          </div>
          <Link
            href="/embed/ghi"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-cyan-400/70 hover:text-cyan-300"
            target="_blank"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Preview embed
          </Link>
        </section>

        {/* Footer */}
        <footer className="text-sm text-white/30">
          <p>
            Data updates daily at 04:30 UTC. All historical snapshots are stored permanently. This
            data is open —{' '}
            <Link
              href="/governance/health/methodology"
              className="text-cyan-400/60 hover:underline"
            >
              methodology
            </Link>{' '}
            and{' '}
            <button onClick={() => downloadJSON(data)} className="text-cyan-400/60 hover:underline">
              raw data
            </button>{' '}
            are freely available.
          </p>
        </footer>
      </div>
    </TooltipProvider>
  );
}
