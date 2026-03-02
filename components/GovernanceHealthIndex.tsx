'use client';

import { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { GHI_BAND_COLORS, GHI_BAND_LABELS, type GHIBand, type GHIComponent } from '@/lib/ghi';
import { spring } from '@/lib/animations';

interface GHIData {
  score: number;
  band: GHIBand;
  components: GHIComponent[];
}

interface GovernanceHealthIndexProps {
  size?: 'hero' | 'compact';
  className?: string;
}

export function GovernanceHealthIndex({ size = 'hero', className = '' }: GovernanceHealthIndexProps) {
  const [data, setData] = useState<GHIData | null>(null);

  useEffect(() => {
    fetch('/api/governance/health-index')
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <GHISkeleton size={size} />;

  return size === 'hero'
    ? <GHIHero data={data} className={className} />
    : <GHICompact data={data} className={className} />;
}

function GHISkeleton({ size }: { size: 'hero' | 'compact' }) {
  const dim = size === 'hero' ? 'h-48 w-48' : 'h-20 w-20';
  return (
    <div className={`${dim} rounded-full bg-muted/30 animate-pulse`} />
  );
}

function GHIHero({ data, className }: { data: GHIData; className: string }) {
  const color = GHI_BAND_COLORS[data.band];
  const label = GHI_BAND_LABELS[data.band];

  const svgSize = 192;
  const strokeWidth = 8;
  const radius = (svgSize - strokeWidth) / 2 - 4;
  const circumference = Math.PI * radius; // half-circle arc
  const arcStart = Math.PI;
  const scoreRatio = data.score / 100;

  const springVal = useSpring(0, { stiffness: 80, damping: 20 });
  const displayScore = useTransform(springVal, v => Math.round(v));
  const dashOffset = useTransform(springVal, v => circumference * (1 - v / 100));

  useEffect(() => {
    springVal.set(data.score);
  }, [data.score, springVal]);

  const cx = svgSize / 2;
  const cy = svgSize / 2 + 16;

  const arcPath = describeArc(cx, cy, radius, 180, 360);
  const trackPath = arcPath;

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

          {/* Track */}
          <path
            d={trackPath}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="text-muted/20"
          />

          {/* Active arc */}
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

          {/* Component segment markers */}
          {data.components.map((comp, i) => {
            const angle = 180 + (comp.contribution / data.score) * 180 * (i / data.components.length);
            return null; // segment markers intentionally omitted for cleanliness
          })}
        </svg>

        {/* Score number */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-3">
          <motion.span
            className="text-5xl font-bold tabular-nums"
            style={{ color }}
          >
            {displayScore}
          </motion.span>
          <span className="text-xs font-medium uppercase tracking-wider mt-0.5" style={{ color }}>
            {label}
          </span>
        </div>
      </div>

      {/* Component breakdown */}
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

function GHICompact({ data, className }: { data: GHIData; className: string }) {
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
        <span className="text-xs font-medium" style={{ color }}>{label}</span>
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
