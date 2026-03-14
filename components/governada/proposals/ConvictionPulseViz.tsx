'use client';

import { useId } from 'react';
import type { ConvictionPulseData } from '@/lib/convictionPulse';
import { cn } from '@/lib/utils';

interface ConvictionPulseVizProps {
  data: ConvictionPulseData;
  className?: string;
}

function MetricPill({ label, value }: { label: string; value: number }) {
  const color =
    value >= 60 ? 'text-emerald-400' : value >= 30 ? 'text-amber-400' : 'text-muted-foreground';

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={cn('text-sm font-bold tabular-nums', color)}>{value}</span>
    </div>
  );
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toFixed(0);
}

export function ConvictionPulseViz({ data, className }: ConvictionPulseVizProps) {
  const gradientId = useId();
  const sentimentGradientId = useId();

  const svgHeight = 60;
  const dotCenterY = svgHeight / 2;

  return (
    <div className={cn('rounded-xl border border-border/50 bg-card/50 p-4 space-y-3', className)}>
      {/* Metrics bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <MetricPill label="Conviction" value={data.conviction} />
          <MetricPill label="Polarization" value={data.polarization} />
        </div>
        <span className="text-xs text-muted-foreground">{data.label}</span>
      </div>

      {/* Spectrum SVG */}
      <svg
        viewBox={`0 0 400 ${svgHeight}`}
        className="w-full"
        style={{ height: `${svgHeight}px` }}
        role="img"
        aria-label="Conviction pulse spectrum showing DRep votes"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
            <stop offset="25%" stopColor="#ef4444" stopOpacity="0.1" />
            <stop offset="40%" stopColor="#a1a1aa" stopOpacity="0.08" />
            <stop offset="60%" stopColor="#a1a1aa" stopOpacity="0.08" />
            <stop offset="75%" stopColor="#10b981" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Background gradient bar */}
        <rect
          x="0"
          y={dotCenterY - 12}
          width="400"
          height="24"
          rx="4"
          fill={`url(#${gradientId})`}
        />

        {/* Zone labels */}
        <text x="10" y={dotCenterY + 24} className="fill-red-500/50" fontSize="9" fontWeight="500">
          No
        </text>
        <text
          x="195"
          y={dotCenterY + 24}
          className="fill-zinc-400/50"
          fontSize="9"
          fontWeight="500"
          textAnchor="middle"
        >
          Abstain
        </text>
        <text
          x="390"
          y={dotCenterY + 24}
          className="fill-emerald-500/50"
          fontSize="9"
          fontWeight="500"
          textAnchor="end"
        >
          Yes
        </text>

        {/* DRep dots */}
        {data.dots.map((dot) => {
          const cx = dot.x * 380 + 10; // 10px padding each side
          const fillColor =
            dot.vote === 'Yes' ? '#10b981' : dot.vote === 'No' ? '#ef4444' : '#a1a1aa';

          const displayName = dot.drepName || `${dot.drepId.slice(0, 12)}...`;
          const powerLabel = `${formatAda(dot.votingPowerAda)} ADA`;

          return (
            <circle
              key={dot.drepId}
              cx={cx}
              cy={dotCenterY}
              r={dot.radius}
              fill={fillColor}
              fillOpacity={0.6}
              stroke={fillColor}
              strokeOpacity={0.8}
              strokeWidth={0.5}
              className="transition-opacity hover:opacity-100"
              style={{ opacity: 0.7 }}
            >
              <title>{`${displayName} - ${dot.vote} (${powerLabel})`}</title>
            </circle>
          );
        })}
      </svg>

      {/* Citizen sentiment bar */}
      {data.citizenSentiment != null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Citizen Sentiment</span>
            <span className="text-[10px] font-medium tabular-nums">{data.citizenSentiment}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <svg viewBox="0 0 100 6" className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id={sentimentGradientId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="50%" stopColor="#a1a1aa" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              <rect
                x="0"
                y="0"
                width={data.citizenSentiment}
                height="6"
                fill={`url(#${sentimentGradientId})`}
                rx="3"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Footer stats */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>{data.totalVoters} voters</span>
        <span className="text-border">|</span>
        <span>{formatAda(data.totalPowerAda)} ADA total</span>
      </div>
    </div>
  );
}
