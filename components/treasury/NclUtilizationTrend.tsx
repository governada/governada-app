'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { TrendingUp } from 'lucide-react';
import type { NclUtilizationHistoryPoint, NclSpendingVelocity } from '@/lib/treasury';

interface NclHistoryResponse {
  history: NclUtilizationHistoryPoint[] | null;
  velocity: NclSpendingVelocity | null;
  ncl: {
    period: { startEpoch: number; endEpoch: number; nclAda: number };
    epochsElapsed: number;
  } | null;
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toLocaleString();
}

export function NclUtilizationTrend() {
  const { data: raw } = useQuery({
    queryKey: ['treasury-ncl-history'],
    queryFn: async () => {
      const res = await fetch('/api/treasury/ncl?history=true');
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<NclHistoryResponse>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const history = useMemo(() => raw?.history ?? [], [raw?.history]);
  const velocity = useMemo(() => raw?.velocity ?? null, [raw?.velocity]);
  const ncl = useMemo(() => raw?.ncl ?? null, [raw?.ncl]);

  const tooEarly = (ncl?.epochsElapsed ?? 0) < 5;

  // Build SVG path for the utilization curve
  const svgData = useMemo(() => {
    if (!ncl || history.length < 2) return null;

    const startEpoch = ncl.period.startEpoch;
    const endEpoch = ncl.period.endEpoch;
    const totalEpochs = endEpoch - startEpoch;
    if (totalEpochs <= 0) return null;

    const W = 400;
    const H = 120;
    const PAD_X = 0;
    const PAD_TOP = 4;
    const PAD_BOTTOM = 0;

    const points = history.map((p) => ({
      x: PAD_X + ((p.epoch - startEpoch) / totalEpochs) * (W - PAD_X * 2),
      y: PAD_TOP + (1 - Math.min(p.utilizationPct, 100) / 100) * (H - PAD_TOP - PAD_BOTTOM),
      pct: p.utilizationPct,
      epoch: p.epoch,
    }));

    // Line path
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    // Area path (fill under curve)
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`;

    // Projection line (dashed) from last point to estimated end
    let projectionPath: string | null = null;
    if (velocity && velocity.projectedEndPct > 0) {
      const lastPoint = points[points.length - 1];
      const projEndY =
        PAD_TOP + (1 - Math.min(velocity.projectedEndPct, 120) / 100) * (H - PAD_TOP - PAD_BOTTOM);
      projectionPath = `M ${lastPoint.x} ${lastPoint.y} L ${W - PAD_X} ${projEndY}`;
    }

    // Threshold lines
    const thresholds = [50, 75, 100].map((pct) => ({
      pct,
      y: PAD_TOP + (1 - pct / 100) * (H - PAD_TOP - PAD_BOTTOM),
    }));

    return { W, H, linePath, areaPath, projectionPath, points, thresholds };
  }, [history, ncl, velocity]);

  if (!ncl || history.length < 1) return null;

  return (
    <div className="space-y-3">
      {tooEarly ? (
        <p className="text-sm text-muted-foreground">
          Not enough data for trend analysis. Check back in a few epochs.
        </p>
      ) : (
        <>
          {/* Chart */}
          {svgData && (
            <div className="w-full">
              <svg
                viewBox={`0 0 ${svgData.W} ${svgData.H}`}
                className="w-full h-auto"
                preserveAspectRatio="none"
              >
                <defs>
                  <filter id="ncl-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
                    <feComposite in2="SourceGraphic" operator="over" />
                  </filter>
                  <linearGradient id="ncl-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>

                {/* Threshold lines */}
                {svgData.thresholds.map((t) => (
                  <line
                    key={t.pct}
                    x1={0}
                    y1={t.y}
                    x2={svgData.W}
                    y2={t.y}
                    stroke="currentColor"
                    strokeWidth={0.5}
                    strokeDasharray="4 4"
                    className={cn(
                      t.pct === 100
                        ? 'text-red-500/40'
                        : t.pct === 75
                          ? 'text-amber-500/30'
                          : 'text-muted-foreground/20',
                    )}
                  />
                ))}

                {/* Area fill */}
                <path d={svgData.areaPath} fill="url(#ncl-gradient)" />

                {/* Glow layer */}
                <path
                  d={svgData.linePath}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={4}
                  className="text-primary"
                  strokeLinejoin="round"
                  filter="url(#ncl-glow)"
                  opacity={0.4}
                />

                {/* Utilization line */}
                <path
                  d={svgData.linePath}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="text-primary"
                  strokeLinejoin="round"
                />

                {/* Projection line */}
                {svgData.projectionPath && (
                  <path
                    d={svgData.projectionPath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    className="text-muted-foreground/50"
                  />
                )}

                {/* Last point dot */}
                {svgData.points.length > 1 && (
                  <circle
                    cx={svgData.points[svgData.points.length - 1].x}
                    cy={svgData.points[svgData.points.length - 1].y}
                    r={3}
                    fill="currentColor"
                    className="text-primary"
                  />
                )}
              </svg>

              {/* Epoch range labels */}
              <div className="flex justify-between text-[10px] text-muted-foreground/70 mt-1 px-0.5">
                <span>E{ncl.period.startEpoch}</span>
                <span>E{ncl.period.endEpoch}</span>
              </div>
            </div>
          )}

          {/* Velocity stats */}
          {velocity && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                <span>
                  ₳{formatAda(velocity.adaPerEpoch)}
                  <span className="text-muted-foreground/70">/epoch</span>
                </span>
              </div>
              <div>
                <span>At current pace: </span>
                <span
                  className={cn(
                    'font-medium',
                    velocity.projectedEndPct > 100
                      ? 'text-red-400'
                      : velocity.projectedEndPct > 75
                        ? 'text-amber-400'
                        : 'text-emerald-400',
                  )}
                >
                  {velocity.projectedEndPct}%
                </span>
                <span className="text-muted-foreground/70"> by period end</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
