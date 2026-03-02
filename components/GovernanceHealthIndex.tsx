'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { GHI_BAND_COLORS, GHI_BAND_LABELS, type GHIBand, type GHIComponent } from '@/lib/ghi';
import { spring } from '@/lib/animations';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface GHIData {
  score: number;
  band: GHIBand;
  components: GHIComponent[];
}

interface GHIHistoryPoint {
  epoch: number;
  score: number;
  band: string;
}

interface GHITrend {
  direction: 'up' | 'down' | 'flat';
  delta: number;
  streakEpochs: number;
}

interface GovernanceHealthIndexProps {
  size?: 'hero' | 'compact';
  className?: string;
}

export function GovernanceHealthIndex({ size = 'hero', className = '' }: GovernanceHealthIndexProps) {
  const [data, setData] = useState<GHIData | null>(null);
  const [history, setHistory] = useState<GHIHistoryPoint[]>([]);
  const [trend, setTrend] = useState<GHITrend | null>(null);

  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/governance/health-index/history?epochs=20')
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        if (res) {
          setData(res.current);
          setHistory(res.history ?? []);
          setTrend(res.trend ?? null);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        fetch('/api/governance/health-index')
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) setData(d); else setFailed(true); })
          .catch(() => setFailed(true));
      });
  }, []);

  if (failed) return <GHIUnavailable size={size} />;
  if (!data) return <GHISkeleton size={size} />;

  return size === 'hero'
    ? <GHIHero data={data} history={history} trend={trend} className={className} />
    : <GHICompact data={data} trend={trend} className={className} />;
}

function GHISkeleton({ size }: { size: 'hero' | 'compact' }) {
  const dim = size === 'hero' ? 'h-48 w-48' : 'h-20 w-20';
  return (
    <div className={`${dim} rounded-full bg-muted/30 animate-pulse`} />
  );
}

function GHIUnavailable({ size }: { size: 'hero' | 'compact' }) {
  const dim = size === 'hero' ? 'h-48 w-48' : 'h-20 w-20';
  return (
    <div className={`${dim} rounded-full bg-muted/20 flex items-center justify-center`}>
      <span className="text-xs text-muted-foreground text-center px-2">
        {size === 'hero' ? 'Governance data syncing…' : '—'}
      </span>
    </div>
  );
}

function GHIHero({ data, history, trend, className }: { data: GHIData; history: GHIHistoryPoint[]; trend: GHITrend | null; className: string }) {
  const color = GHI_BAND_COLORS[data.band];
  const label = GHI_BAND_LABELS[data.band];

  const svgSize = 192;
  const strokeWidth = 8;
  const radius = (svgSize - strokeWidth) / 2 - 4;
  const circumference = Math.PI * radius;

  const springVal = useSpring(0, { stiffness: 80, damping: 20 });
  const displayScore = useTransform(springVal, v => Math.round(v));
  const dashOffset = useTransform(springVal, v => circumference * (1 - v / 100));

  useEffect(() => {
    springVal.set(data.score);
  }, [data.score, springVal]);

  const cx = svgSize / 2;
  const cy = svgSize / 2 + 16;
  const trackPath = describeArc(cx, cy, radius, 180, 360);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring.smooth}
      className={`flex flex-col items-center gap-3 ${className}`}
    >
      <div className="relative" style={{ width: svgSize, height: svgSize / 2 + 40 }}>
        <svg
          width={svgSize}
          height={svgSize / 2 + 40}
          viewBox={`0 0 ${svgSize} ${svgSize / 2 + 40}`}
          className="overflow-visible"
        >
          <defs>
            <filter id="ghi-glow">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <path
            d={trackPath}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="text-muted/20"
          />

          <motion.path
            d={trackPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: dashOffset }}
            filter="url(#ghi-glow)"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-end pb-3">
          <motion.span className="text-5xl font-bold tabular-nums" style={{ color }}>
            {displayScore}
          </motion.span>
          <span className="text-xs font-medium uppercase tracking-wider mt-0.5" style={{ color }}>
            {label}
          </span>
        </div>
      </div>

      {trend && trend.delta !== 0 && <TrendBadge trend={trend} color={color} />}

      {history.length >= 3 && <GHISparkline history={history} currentScore={data.score} color={color} />}

      <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-center">
        {data.components.map(comp => (
          <div key={comp.name} className="flex flex-col items-center">
            <span className="text-xs text-muted-foreground">{comp.name}</span>
            <span className="text-sm font-semibold tabular-nums">{comp.value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function TrendBadge({ trend, color }: { trend: GHITrend; color: string }) {
  const TrendIcon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
  const sign = trend.delta > 0 ? '+' : '';
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
      style={{
        backgroundColor: `${color}15`,
        color,
      }}
    >
      <TrendIcon className="h-3 w-3" />
      <span className="tabular-nums">{sign}{Math.round(trend.delta * 10) / 10} vs last epoch</span>
    </motion.div>
  );
}

function GHISparkline({ history, currentScore, color }: { history: GHIHistoryPoint[]; currentScore: number; color: string }) {
  const W = 200;
  const H = 40;
  const PAD = 4;

  const points = useMemo(() => {
    const sorted = [...history].sort((a, b) => a.epoch - b.epoch);
    sorted.push({ epoch: (sorted.at(-1)?.epoch ?? 0) + 1, score: currentScore, band: '' });

    const scores = sorted.map(p => p.score);
    const minS = Math.min(...scores) - 5;
    const maxS = Math.max(...scores) + 5;
    const range = maxS - minS || 1;

    return sorted.map((p, i) => ({
      x: PAD + (i / (sorted.length - 1)) * (W - PAD * 2),
      y: PAD + (1 - (p.score - minS) / range) * (H - PAD * 2),
      epoch: p.epoch,
      score: p.score,
    }));
  }, [history, currentScore]);

  if (points.length < 2) return null;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points.at(-1)!.x} ${H} L ${points[0].x} ${H} Z`;
  const lastPt = points.at(-1)!;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="w-[200px]"
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        <defs>
          <linearGradient id="ghi-spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#ghi-spark-fill)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastPt.x} cy={lastPt.y} r={3} fill={color} />
      </svg>
    </motion.div>
  );
}

function GHICompact({ data, trend, className }: { data: GHIData; trend: GHITrend | null; className: string }) {
  const color = GHI_BAND_COLORS[data.band];
  const label = GHI_BAND_LABELS[data.band];

  const springVal = useSpring(0, { stiffness: 80, damping: 20 });
  const displayScore = useTransform(springVal, v => Math.round(v));

  useEffect(() => {
    springVal.set(data.score);
  }, [data.score, springVal]);

  const svgSize = 64;
  const strokeWidth = 4;
  const radius = (svgSize - strokeWidth) / 2 - 2;
  const circumference = Math.PI * radius;
  const cx = svgSize / 2;
  const cy = svgSize / 2 + 8;
  const trackPath = describeArc(cx, cy, radius, 180, 360);
  const dashOffset = useTransform(springVal, v => circumference * (1 - v / 100));

  const TrendIcon = trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex items-center gap-2 ${className}`}
    >
      <div className="relative" style={{ width: svgSize, height: svgSize / 2 + 12 }}>
        <svg
          width={svgSize}
          height={svgSize / 2 + 12}
          viewBox={`0 0 ${svgSize} ${svgSize / 2 + 12}`}
          className="overflow-visible"
        >
          <path d={trackPath} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" className="text-muted/20" />
          <motion.path d={trackPath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} style={{ strokeDashoffset: dashOffset }} />
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-0.5">
          <motion.span className="text-lg font-bold tabular-nums" style={{ color }}>{displayScore}</motion.span>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium" style={{ color }}>{label}</span>
          {TrendIcon && trend && trend.delta !== 0 && (
            <TrendIcon className="h-3 w-3" style={{ color }} />
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">Health Index</span>
      </div>
    </motion.div>
  );
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}
