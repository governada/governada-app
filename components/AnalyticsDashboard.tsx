'use client';

import { useMemo, useState, useCallback, type MouseEvent } from 'react';
import { scaleLinear, scalePoint, scaleBand } from 'd3-scale';
import { line, area as d3area, curveMonotoneX } from 'd3-shape';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity, Target, BarChart3, Users } from 'lucide-react';
import { useChartDimensions } from '@/lib/charts/useChartDimensions';
import { GlowFilter, AreaGradient } from '@/lib/charts/GlowDefs';
import { chartTheme, CHART_PALETTE, VOTE_CHART_COLORS } from '@/lib/charts/theme';
import type { ScoreSnapshot } from '@/lib/data';

interface PillarData {
  effectiveParticipation: number;
  rationaleRate: number;
  reliabilityScore: number;
  profileCompleteness: number;
  deliberationModifier: number;
}

interface AnalyticsDashboardProps {
  scoreHistory: ScoreSnapshot[];
  pillars: PillarData;
  votes: { vote: string; date: Date; proposalType: string | null }[];
  drepScore: number;
  percentile?: number;
}

const PILLAR_AXES = [
  { key: 'participation' as const, label: 'Participation', angle: -Math.PI / 2 },
  { key: 'rationale' as const, label: 'Rationale', angle: 0 },
  { key: 'reliability' as const, label: 'Reliability', angle: Math.PI / 2 },
  { key: 'profile' as const, label: 'Profile', angle: Math.PI },
];

const GRID_LEVELS = [25, 50, 75, 100];

function radarPoint(angle: number, value: number, radius: number) {
  const r = (value / 100) * radius;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

/* ── Pillar Radar ──────────────────────────────────────────── */

function PillarRadarChart({ data }: { data: { pillar: string; value: number }[] }) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 100;

  const values = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of data) map[d.pillar.toLowerCase()] = d.value;
    return PILLAR_AXES.map((a) => map[a.key] ?? 0);
  }, [data]);

  const dataPoints = useMemo(
    () => PILLAR_AXES.map((a, i) => radarPoint(a.angle, values[i], radius)),
    [values],
  );

  const dataPath = dataPoints.map((p) => `${cx + p.x},${cy + p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-h-[260px] mx-auto">
      <defs>
        <GlowFilter id="pillar-glow" stdDeviation={4} />
      </defs>

      {GRID_LEVELS.map((level) => {
        const pts = PILLAR_AXES.map((a) => radarPoint(a.angle, level, radius));
        return (
          <polygon
            key={level}
            points={pts.map((p) => `${cx + p.x},${cy + p.y}`).join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.5}
            className="text-border"
          />
        );
      })}

      {PILLAR_AXES.map((a) => {
        const end = radarPoint(a.angle, 100, radius);
        return (
          <line
            key={a.key}
            x1={cx}
            y1={cy}
            x2={cx + end.x}
            y2={cy + end.y}
            stroke="currentColor"
            strokeWidth={0.5}
            className="text-border"
          />
        );
      })}

      <polygon
        points={dataPath}
        fill={CHART_PALETTE[0]}
        fillOpacity={0.2}
        stroke={CHART_PALETTE[0]}
        strokeWidth={2}
        filter="url(#pillar-glow)"
      />
      <polygon
        points={dataPath}
        fill={CHART_PALETTE[0]}
        fillOpacity={0.15}
        stroke={CHART_PALETTE[0]}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {dataPoints.map((p, i) => (
        <circle
          key={PILLAR_AXES[i].key}
          cx={cx + p.x}
          cy={cy + p.y}
          r={4}
          fill={CHART_PALETTE[0]}
          stroke="oklch(0.07 0.015 260)"
          strokeWidth={1.5}
        />
      ))}

      {PILLAR_AXES.map((a, i) => {
        const labelDist = radius + 22;
        const lp = radarPoint(a.angle, 100, labelDist);
        const isTop = a.angle === -Math.PI / 2;
        const isBottom = a.angle === Math.PI / 2;
        return (
          <text
            key={a.key}
            x={cx + lp.x}
            y={cy + lp.y + (isTop ? -4 : isBottom ? 10 : 0)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            className="fill-muted-foreground"
          >
            {a.label} ({values[i]})
          </text>
        );
      })}
    </svg>
  );
}

/* ── Score History Line ────────────────────────────────────── */

const SERIES_CONFIG = [
  { key: 'score' as const, label: 'Overall Score', color: CHART_PALETTE[0], width: 2.5, dash: '' },
  { key: 'participation' as const, label: 'Participation', color: CHART_PALETTE[1], width: 1.5, dash: '4 4' },
  { key: 'rationale' as const, label: 'Rationale', color: CHART_PALETTE[2], width: 1.5, dash: '4 4' },
];

function ScoreHistoryLine({ data }: { data: { date: string; score: number; participation: number; rationale: number }[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { containerRef, dimensions } = useChartDimensions(280);
  const { width, innerWidth, innerHeight, margin } = dimensions;

  const xScale = useMemo(
    () => scalePoint<string>().domain(data.map((d) => d.date)).range([0, innerWidth]).padding(0.1),
    [data, innerWidth],
  );
  const yScale = useMemo(() => scaleLinear().domain([0, 100]).range([innerHeight, 0]), [innerHeight]);

  const paths = useMemo(
    () =>
      SERIES_CONFIG.map((s) => {
        const gen = line<(typeof data)[0]>()
          .x((d) => xScale(d.date) ?? 0)
          .y((d) => yScale(d[s.key]))
          .curve(curveMonotoneX);
        return { ...s, d: gen(data) ?? '' };
      }),
    [data, xScale, yScale],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGRectElement>) => {
      const svg = e.currentTarget.closest('svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const relX = e.clientX - rect.left - margin.left;
      const step = innerWidth / Math.max(1, data.length - 1);
      setHoveredIndex(Math.max(0, Math.min(data.length - 1, Math.round(relX / step))));
    },
    [data.length, innerWidth, margin.left],
  );

  const hovered = hoveredIndex !== null ? data[hoveredIndex] : null;
  const ticks = yScale.ticks(5);
  const xTicks = data.length <= 8 ? data : data.filter((_, i) => i % Math.ceil(data.length / 8) === 0);

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: 280 }}>
      {width > 0 && (
        <svg width={width} height={280}>
          <defs>
            <GlowFilter id="score-hist-glow" stdDeviation={3} />
            <AreaGradient id="score-hist-area" color={CHART_PALETTE[0]} topOpacity={0.12} />
          </defs>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={innerWidth} y1={yScale(t)} y2={yScale(t)} stroke="currentColor" strokeWidth={0.5} strokeDasharray="4 4" className="text-border" />
                <text x={-8} y={yScale(t)} textAnchor="end" dominantBaseline="central" fontSize={chartTheme.font.size.tick} className="fill-muted-foreground">{t}</text>
              </g>
            ))}
            {xTicks.map((d) => (
              <text key={d.date} x={xScale(d.date) ?? 0} y={innerHeight + 18} textAnchor="middle" fontSize={chartTheme.font.size.tick} className="fill-muted-foreground">{d.date}</text>
            ))}

            <path d={paths[0].d} fill="none" stroke={CHART_PALETTE[0]} strokeWidth={3} filter="url(#score-hist-glow)" opacity={0.4} />
            {paths.map((p) => (
              <path key={p.key} d={p.d} fill="none" stroke={p.color} strokeWidth={p.width} strokeDasharray={p.dash} strokeLinejoin="round" strokeLinecap="round" />
            ))}

            {data.map((d, i) => (
              <circle key={i} cx={xScale(d.date) ?? 0} cy={yScale(d.score)} r={hoveredIndex === i ? 5 : 3} fill={CHART_PALETTE[0]} stroke="oklch(0.07 0.015 260)" strokeWidth={1.5} />
            ))}

            {hoveredIndex !== null && (
              <line x1={xScale(data[hoveredIndex].date) ?? 0} x2={xScale(data[hoveredIndex].date) ?? 0} y1={0} y2={innerHeight} stroke="currentColor" strokeWidth={0.5} strokeDasharray="3 3" className="text-muted-foreground" />
            )}

            <rect x={0} y={0} width={innerWidth} height={innerHeight} fill="transparent" onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredIndex(null)} />
          </g>
        </svg>
      )}
      {hovered && width > 0 && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: margin.left + (xScale(hovered.date) ?? 0),
            top: margin.top + yScale(hovered.score) - 10,
            transform: `translate(${(xScale(hovered.date) ?? 0) > innerWidth * 0.7 ? '-110%' : '10%'}, -50%)`,
          }}
        >
          <div className="rounded-lg border bg-card p-2.5 shadow-xl text-xs min-w-[140px] backdrop-blur-sm dark:border-border/60 dark:bg-card/95">
            <p className="font-medium mb-1">{hovered.date}</p>
            {SERIES_CONFIG.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
                <span className="font-mono tabular-nums">{hovered[s.key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-4 justify-center mt-1">
        {SERIES_CONFIG.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-3 h-0.5 rounded" style={{ backgroundColor: s.color, ...(s.dash ? { borderTop: `1.5px dashed ${s.color}`, background: 'none' } : {}) }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Vote Activity Stacked Area ────────────────────────────── */

const VOTE_KEYS: ('yes' | 'no' | 'abstain')[] = ['yes', 'no', 'abstain'];
const VOTE_LABELS: Record<string, string> = { yes: 'Yes', no: 'No', abstain: 'Abstain' };
const VOTE_COLORS: Record<string, string> = { yes: VOTE_CHART_COLORS.Yes, no: VOTE_CHART_COLORS.No, abstain: VOTE_CHART_COLORS.Abstain };

function VoteActivityArea({ data }: { data: { month: string; yes: number; no: number; abstain: number }[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { containerRef, dimensions } = useChartDimensions(280);
  const { width, innerWidth, innerHeight, margin } = dimensions;

  const yMax = useMemo(() => {
    let m = 0;
    for (const d of data) m = Math.max(m, d.yes + d.no + d.abstain);
    return Math.max(m, 1);
  }, [data]);

  const xScale = useMemo(
    () => scalePoint<string>().domain(data.map((d) => d.month)).range([0, innerWidth]).padding(0.1),
    [data, innerWidth],
  );
  const yScale = useMemo(() => scaleLinear().domain([0, yMax]).range([innerHeight, 0]), [yMax, innerHeight]);

  const layers = useMemo(
    () =>
      VOTE_KEYS.map((key) => {
        const gen = d3area<(typeof data)[0]>()
          .x((d) => xScale(d.month) ?? 0)
          .y0((d) => {
            let base = 0;
            for (const k of VOTE_KEYS) {
              if (k === key) break;
              base += d[k];
            }
            return yScale(base);
          })
          .y1((d) => {
            let top = 0;
            for (const k of VOTE_KEYS) {
              top += d[k];
              if (k === key) break;
            }
            return yScale(top);
          })
          .curve(curveMonotoneX);
        return { key, path: gen(data) ?? '', color: VOTE_COLORS[key] };
      }),
    [data, xScale, yScale],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGRectElement>) => {
      const svg = e.currentTarget.closest('svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const relX = e.clientX - rect.left - margin.left;
      const step = innerWidth / Math.max(1, data.length - 1);
      setHoveredIndex(Math.max(0, Math.min(data.length - 1, Math.round(relX / step))));
    },
    [data.length, innerWidth, margin.left],
  );

  const hovered = hoveredIndex !== null ? data[hoveredIndex] : null;
  const ticks = yScale.ticks(4);
  const xTicks = data.length <= 6 ? data : data.filter((_, i) => i % Math.ceil(data.length / 6) === 0);

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: 280 }}>
      {width > 0 && (
        <svg width={width} height={280}>
          <defs>
            {VOTE_KEYS.map((k) => (
              <AreaGradient key={k} id={`ad-vote-${k}`} color={VOTE_COLORS[k]} topOpacity={0.35} />
            ))}
          </defs>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={innerWidth} y1={yScale(t)} y2={yScale(t)} stroke="currentColor" strokeWidth={0.5} strokeDasharray="4 4" className="text-border" />
                <text x={-8} y={yScale(t)} textAnchor="end" dominantBaseline="central" fontSize={chartTheme.font.size.tick} className="fill-muted-foreground">{t}</text>
              </g>
            ))}
            {xTicks.map((d) => (
              <text key={d.month} x={xScale(d.month) ?? 0} y={innerHeight + 18} textAnchor="middle" fontSize={chartTheme.font.size.tick} className="fill-muted-foreground">{d.month}</text>
            ))}

            {layers.map(({ key, path, color }) => (
              <path key={key} d={path} fill={`url(#ad-vote-${key})`} stroke={color} strokeWidth={1.5} />
            ))}

            {hoveredIndex !== null && (
              <line x1={xScale(data[hoveredIndex].month) ?? 0} x2={xScale(data[hoveredIndex].month) ?? 0} y1={0} y2={innerHeight} stroke="currentColor" strokeWidth={0.5} strokeDasharray="3 3" className="text-muted-foreground" />
            )}

            <rect x={0} y={0} width={innerWidth} height={innerHeight} fill="transparent" onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredIndex(null)} />
          </g>
        </svg>
      )}
      {hovered && width > 0 && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: margin.left + (xScale(hovered.month) ?? 0),
            top: 40,
            transform: `translateX(${(xScale(hovered.month) ?? 0) > innerWidth * 0.7 ? '-110%' : '10%'})`,
          }}
        >
          <div className="rounded-lg border bg-card p-2.5 shadow-xl text-xs min-w-[120px] backdrop-blur-sm dark:border-border/60 dark:bg-card/95">
            <p className="font-medium mb-1">{hovered.month}</p>
            {VOTE_KEYS.map((k) => (
              <div key={k} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: VOTE_COLORS[k] }} />
                  {VOTE_LABELS[k]}
                </span>
                <span className="font-mono tabular-nums">{hovered[k]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-4 justify-center mt-1">
        {VOTE_KEYS.map((k) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: VOTE_COLORS[k] }} />
            {VOTE_LABELS[k]}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Proposal Type Horizontal Bar ──────────────────────────── */

function ProposalTypeBar({ data }: { data: { type: string; count: number }[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartHeight = Math.max(200, data.length * 36 + 40);
  const { containerRef, dimensions } = useChartDimensions(chartHeight, { left: 90, top: 8, bottom: 12 });
  const { width, innerWidth, innerHeight, margin } = dimensions;

  const xMax = useMemo(() => Math.max(...data.map((d) => d.count), 1), [data]);
  const xScale = useMemo(() => scaleLinear().domain([0, xMax]).range([0, innerWidth]).nice(), [xMax, innerWidth]);
  const yScale = useMemo(
    () => scaleBand<string>().domain(data.map((d) => d.type)).range([0, innerHeight]).padding(0.3),
    [data, innerHeight],
  );

  const xTicks = xScale.ticks(5).filter(Number.isInteger);

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: chartHeight }}>
      {width > 0 && (
        <svg width={width} height={chartHeight}>
          <defs>
            <GlowFilter id="bar-glow" stdDeviation={2} />
          </defs>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {xTicks.map((t) => (
              <g key={t}>
                <line x1={xScale(t)} x2={xScale(t)} y1={0} y2={innerHeight} stroke="currentColor" strokeWidth={0.5} strokeDasharray="4 4" className="text-border" />
                <text x={xScale(t)} y={innerHeight + 14} textAnchor="middle" fontSize={chartTheme.font.size.tick} className="fill-muted-foreground">{t}</text>
              </g>
            ))}

            {data.map((d, i) => {
              const y = yScale(d.type) ?? 0;
              const barHeight = yScale.bandwidth();
              const barWidth = xScale(d.count);
              return (
                <g
                  key={d.type}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="cursor-default"
                >
                  <text x={-6} y={y + barHeight / 2} textAnchor="end" dominantBaseline="central" fontSize={chartTheme.font.size.tick} className="fill-muted-foreground">
                    {d.type}
                  </text>
                  <rect x={0} y={y} width={barWidth} height={barHeight} rx={3} fill={CHART_PALETTE[0]} opacity={hoveredIndex === i ? 1 : 0.8} filter={hoveredIndex === i ? 'url(#bar-glow)' : undefined} />
                  {barWidth > 30 && (
                    <text x={barWidth - 6} y={y + barHeight / 2} textAnchor="end" dominantBaseline="central" fontSize={10} fill="white" fontWeight={600}>
                      {d.count}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}

/* ── KPI Card ──────────────────────────────────────────────── */

function KpiCard({
  title,
  value,
  suffix = '',
  change,
  description,
  icon,
  showTrend,
}: {
  title: string;
  value: number | null;
  suffix?: string;
  change?: number | null;
  description?: string;
  icon: React.ReactNode;
  showTrend?: boolean;
}) {
  const displayValue = value !== null ? value : '\u2014';
  const effectiveNum = showTrend ? value : change;
  const isPositive = effectiveNum != null && effectiveNum > 0;
  const isNegative = effectiveNum != null && effectiveNum < 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums">{displayValue}</span>
          {value !== null && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
        {change != null && change !== 0 && !showTrend && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${isPositive ? 'text-primary' : 'text-destructive'}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {change > 0 ? '+' : ''}{change} from last snapshot
          </div>
        )}
        {showTrend && value !== null && value !== 0 && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${isPositive ? 'text-primary' : isNegative ? 'text-destructive' : 'text-muted-foreground'}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {value > 0 ? '+' : ''}{value}{suffix}
          </div>
        )}
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

/* ── Helpers ───────────────────────────────────────────────── */

function formatProposalType(type: string): string {
  const map: Record<string, string> = {
    TreasuryWithdrawals: 'Treasury',
    ParameterChange: 'Params',
    HardForkInitiation: 'Hard Fork',
    NoConfidence: 'No Confidence',
    NewCommittee: 'Committee',
    NewConstitutionalCommittee: 'Committee',
    NewConstitution: 'Constitution',
    UpdateConstitution: 'Constitution',
    InfoAction: 'Info',
  };
  return map[type] || type;
}

/* ── Main Component ────────────────────────────────────────── */

export function AnalyticsDashboard({
  scoreHistory,
  pillars,
  votes,
  drepScore,
  percentile,
}: AnalyticsDashboardProps) {
  const radarData = useMemo(
    () => [
      { pillar: 'Participation', value: pillars.effectiveParticipation, fullMark: 100 },
      { pillar: 'Rationale', value: pillars.rationaleRate, fullMark: 100 },
      { pillar: 'Reliability', value: pillars.reliabilityScore, fullMark: 100 },
      { pillar: 'Profile', value: pillars.profileCompleteness, fullMark: 100 },
    ],
    [pillars],
  );

  const historyData = useMemo(
    () =>
      scoreHistory.map((s) => ({
        date: new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: s.score,
        participation: s.effectiveParticipation,
        rationale: s.rationaleRate,
      })),
    [scoreHistory],
  );

  const monthlyVotes = useMemo(() => {
    const grouped: Record<string, { month: string; dateObj: Date; yes: number; no: number; abstain: number }> = {};
    for (const v of votes) {
      const month = v.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      if (!grouped[month]) {
        grouped[month] = { month, dateObj: new Date(v.date.getFullYear(), v.date.getMonth(), 1), yes: 0, no: 0, abstain: 0 };
      }
      const key = v.vote.toLowerCase() as 'yes' | 'no' | 'abstain';
      if (key in grouped[month]) grouped[month][key]++;
    }
    return Object.values(grouped).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [votes]);

  const proposalTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of votes) {
      const type = v.proposalType || 'Unknown';
      counts[type] = (counts[type] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([type, count]) => ({ type: formatProposalType(type), count }))
      .sort((a, b) => b.count - a.count);
  }, [votes]);

  const scoreChange = scoreHistory.length >= 2
    ? scoreHistory[scoreHistory.length - 1].score - scoreHistory[scoreHistory.length - 2].score
    : null;

  const scoreTrend = scoreHistory.length >= 3
    ? scoreHistory[scoreHistory.length - 1].score - scoreHistory[0].score
    : null;

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="DRep Score" value={drepScore} suffix="/100" change={scoreChange} icon={<Target className="h-4 w-4" />} />
        <KpiCard title="Percentile" value={percentile ?? null} suffix="%" description="Among active DReps" icon={<Users className="h-4 w-4" />} />
        <KpiCard
          title="Total Votes"
          value={votes.length}
          description={`${votes.filter((v) => v.vote === 'Yes').length}Y / ${votes.filter((v) => v.vote === 'No').length}N / ${votes.filter((v) => v.vote === 'Abstain').length}A`}
          icon={<Activity className="h-4 w-4" />}
        />
        <KpiCard title="Score Trend" value={scoreTrend} suffix=" pts" description="Since tracking started" icon={<BarChart3 className="h-4 w-4" />} showTrend />
      </div>

      {/* Charts Row 1: Radar + Score History */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pillar Breakdown</CardTitle>
            <CardDescription>Performance across scoring dimensions</CardDescription>
          </CardHeader>
          <CardContent>
            <PillarRadarChart data={radarData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Score History</CardTitle>
            <CardDescription>Overall score and pillar trends over time</CardDescription>
          </CardHeader>
          <CardContent>
            {historyData.length > 1 ? (
              <ScoreHistoryLine data={historyData} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                More snapshots needed to show trend data.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Vote Activity + Proposal Types */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Voting Activity</CardTitle>
            <CardDescription>Monthly vote distribution by outcome</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyVotes.length > 0 ? (
              <VoteActivityArea data={monthlyVotes} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                No voting activity to display.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Votes by Proposal Type</CardTitle>
            <CardDescription>Distribution of governance participation</CardDescription>
          </CardHeader>
          <CardContent>
            {proposalTypeCounts.length > 0 ? (
              <ProposalTypeBar data={proposalTypeCounts} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                No proposal data available.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
