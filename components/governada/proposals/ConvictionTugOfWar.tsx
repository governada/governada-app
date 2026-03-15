'use client';

import { useMemo, useId, useRef, useEffect, useState } from 'react';
import type { ConvictionPulseData } from '@/lib/convictionPulse';
import type { VotePowerByEpoch } from '@/lib/data';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface PowerFallback {
  yesPower: number;
  noPower: number;
  abstainPower: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
}

interface ConvictionTugOfWarProps {
  data: ConvictionPulseData;
  powerByEpoch: VotePowerByEpoch[];
  /** Canonical power data from proposal_voting_summary — used when per-vote power is null */
  powerFallback?: PowerFallback | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function MetricDisplay({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: number;
  tooltip: string;
}) {
  const color =
    value >= 60 ? 'text-emerald-400' : value >= 30 ? 'text-amber-400' : 'text-muted-foreground';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-help">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
            <span className={cn('text-lg font-bold tabular-nums leading-none', color)}>
              {value}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-64 text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatAda(lovelace: number): string {
  const ada = lovelace / 1_000_000;
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toFixed(0);
}

function formatAdaShort(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toFixed(0);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConvictionTugOfWar({
  data,
  powerByEpoch,
  powerFallback,
  className,
}: ConvictionTugOfWarProps) {
  const cssId = useId().replace(/:/g, '');

  // Aggregate vote power — prefer per-epoch data, fall back to canonical summary
  const totals = useMemo(() => {
    let yes = powerByEpoch.reduce((s, p) => s + p.yesPower, 0);
    let no = powerByEpoch.reduce((s, p) => s + p.noPower, 0);
    let abstain = powerByEpoch.reduce((s, p) => s + p.abstainPower, 0);
    let yesCount = powerByEpoch.reduce((s, p) => s + p.yesCount, 0);
    let noCount = powerByEpoch.reduce((s, p) => s + p.noCount, 0);
    let abstainCount = powerByEpoch.reduce((s, p) => s + p.abstainCount, 0);

    // Fall back to canonical data if per-vote power is missing
    if (yes + no + abstain === 0 && powerFallback) {
      yes = powerFallback.yesPower;
      no = powerFallback.noPower;
      abstain = powerFallback.abstainPower;
      yesCount = powerFallback.yesCount;
      noCount = powerFallback.noCount;
      abstainCount = powerFallback.abstainCount;
    }

    const total = yes + no + abstain;
    return {
      yes,
      no,
      abstain,
      yesCount,
      noCount,
      abstainCount,
      total,
      yesPct: total > 0 ? (yes / total) * 100 : 50,
      noPct: total > 0 ? (no / total) * 100 : 50,
    };
  }, [powerByEpoch, powerFallback]);

  // The balance point: where No ends and Yes begins (as fraction 0-1)
  // 0 = all Yes, 1 = all No. We flip so Yes is right, No is left.
  const balancePoint = totals.total > 0 ? totals.no / (totals.yes + totals.no || 1) : 0.5;

  // Conviction affects glow intensity
  const glowIntensity = Math.max(0.3, data.conviction / 100);

  // Animation: reveal from center outward
  const [progress, setProgress] = useState(0);
  const animRef = useRef(false);

  useEffect(() => {
    if (animRef.current) return;
    animRef.current = true;
    const start = performance.now();
    const duration = 1500;

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(eased);
      if (t < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, []);

  // Clash point pulse
  const [clashGlow, setClashGlow] = useState(0.5);
  useEffect(() => {
    let frame: number;
    const start = performance.now();

    function pulse(now: number) {
      const t = ((now - start) % 2000) / 2000;
      setClashGlow(0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2)));
      frame = requestAnimationFrame(pulse);
    }

    frame = requestAnimationFrame(pulse);
    return () => cancelAnimationFrame(frame);
  }, []);

  const svgWidth = 600;
  const svgHeight = 60;
  const beamY = 16;
  const beamHeight = 28;
  const clashX = balancePoint * svgWidth;

  // Animated widths
  const noWidth = clashX * progress;
  const yesWidth = (svgWidth - clashX) * progress;

  const hasPower = totals.total > 0;
  const yesWinning = totals.yes > totals.no;

  return (
    <div className={cn('rounded-xl border border-border/50 bg-card/50 overflow-hidden', className)}>
      {/* Metrics row */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-5">
          <MetricDisplay
            label="Conviction"
            value={data.conviction}
            tooltip="How deeply DReps care about this proposal (0-100). Based on rationale rate, quality of reasoning, and breadth of participation. High conviction means DReps are engaging seriously."
          />
          <MetricDisplay
            label="Polarization"
            value={data.polarization}
            tooltip="How divided the community is on this proposal (0-100). Low = broad consensus, High = sharp disagreement. Based on the distribution of voting power across Yes, No, and Abstain."
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{data.totalVoters} voters</span>
          <span className="text-border">|</span>
          <span>{formatAdaShort(data.totalPowerAda)} ADA</span>
        </div>
      </div>

      {/* Tug-of-war beam */}
      <div className="px-5 pb-4">
        {hasPower ? (
          <>
            {/* Side labels */}
            <div className="flex items-end justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-red-400">No</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {totals.noCount} voter{totals.noCount !== 1 ? 's' : ''}
                </span>
              </div>
              {totals.abstainCount > 0 && (
                <div className="text-xs text-muted-foreground text-center">
                  {totals.abstainCount} abstain
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {totals.yesCount} voter{totals.yesCount !== 1 ? 's' : ''}
                </span>
                <span className="text-sm font-semibold text-emerald-400">Yes</span>
              </div>
            </div>

            {/* SVG beam */}
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full"
              style={{ height: '60px' }}
              role="img"
              aria-label={`Voting power balance: ${Math.round(totals.yesPct)}% Yes, ${Math.round(totals.noPct)}% No`}
            >
              <defs>
                {/* No side gradient: red from left edge, fading to center */}
                <linearGradient id={`no-grad-${cssId}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9 * glowIntensity} />
                  <stop offset="70%" stopColor="#ef4444" stopOpacity={0.7 * glowIntensity} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.5 * glowIntensity} />
                </linearGradient>
                {/* Yes side gradient: green from right edge, fading to center */}
                <linearGradient id={`yes-grad-${cssId}`} x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.9 * glowIntensity} />
                  <stop offset="70%" stopColor="#10b981" stopOpacity={0.7 * glowIntensity} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.5 * glowIntensity} />
                </linearGradient>
                {/* Glow filters */}
                <filter id={`no-glow-${cssId}`} x="-10%" y="-50%" width="120%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
                </filter>
                <filter id={`yes-glow-${cssId}`} x="-10%" y="-50%" width="120%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
                </filter>
                <filter id={`clash-filter-${cssId}`} x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
                </filter>
              </defs>

              {/* Background track */}
              <rect
                x="0"
                y={beamY}
                width={svgWidth}
                height={beamHeight}
                rx={beamHeight / 2}
                fill="currentColor"
                fillOpacity={0.06}
              />

              {/* No side: outer glow */}
              <rect
                x={clashX - noWidth}
                y={beamY}
                width={noWidth}
                height={beamHeight}
                rx={beamHeight / 2}
                fill="#ef4444"
                opacity={0.15 * glowIntensity}
                filter={`url(#no-glow-${cssId})`}
              />

              {/* No side: solid beam, growing from clash point leftward */}
              <rect
                x={clashX - noWidth}
                y={beamY}
                width={noWidth}
                height={beamHeight}
                rx={noWidth > beamHeight ? beamHeight / 2 : noWidth / 2}
                fill={`url(#no-grad-${cssId})`}
              />

              {/* Yes side: outer glow */}
              <rect
                x={clashX}
                y={beamY}
                width={yesWidth}
                height={beamHeight}
                rx={beamHeight / 2}
                fill="#10b981"
                opacity={0.15 * glowIntensity}
                filter={`url(#yes-glow-${cssId})`}
              />

              {/* Yes side: solid beam, growing from clash point rightward */}
              <rect
                x={clashX}
                y={beamY}
                width={yesWidth}
                height={beamHeight}
                rx={yesWidth > beamHeight ? beamHeight / 2 : yesWidth / 2}
                fill={`url(#yes-grad-${cssId})`}
              />

              {/* Clash point: bright energy collision */}
              {progress > 0.8 && (
                <>
                  {/* Outer glow */}
                  <circle
                    cx={clashX}
                    cy={beamY + beamHeight / 2}
                    r={12}
                    fill="white"
                    opacity={0.12 * clashGlow}
                    filter={`url(#clash-filter-${cssId})`}
                  />
                  {/* Inner bright point */}
                  <circle
                    cx={clashX}
                    cy={beamY + beamHeight / 2}
                    r={4}
                    fill="white"
                    opacity={0.6 * clashGlow}
                  />
                  {/* Tiny spark ring */}
                  <circle
                    cx={clashX}
                    cy={beamY + beamHeight / 2}
                    r={8}
                    fill="none"
                    stroke="white"
                    strokeWidth={0.5}
                    opacity={0.2 * clashGlow}
                  />
                </>
              )}

              {/* Power labels at bottom */}
              <text x={8} y={svgHeight - 2} className="fill-red-400" fontSize="11" fontWeight="600">
                {formatAda(totals.no)} ADA
              </text>

              {/* Center percentage */}
              <text
                x={svgWidth / 2}
                y={svgHeight - 2}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="10"
              >
                {Math.round(totals.noPct)}% — {Math.round(totals.yesPct)}%
              </text>

              <text
                x={svgWidth - 8}
                y={svgHeight - 2}
                textAnchor="end"
                className="fill-emerald-400"
                fontSize="11"
                fontWeight="600"
              >
                {formatAda(totals.yes)} ADA
              </text>
            </svg>

            {/* Summary label */}
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">{data.label}</span>
              <span className="text-xs text-muted-foreground">
                {yesWinning ? (
                  <span className="text-emerald-400 font-medium">Yes leads</span>
                ) : totals.yes === totals.no ? (
                  <span className="text-amber-400 font-medium">Tied</span>
                ) : (
                  <span className="text-red-400 font-medium">No leads</span>
                )}
                {' by voting power'}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-16 text-sm text-muted-foreground">
            The force balance will appear as DReps cast their votes.
          </div>
        )}
      </div>
    </div>
  );
}
