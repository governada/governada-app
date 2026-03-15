'use client';

import { useMemo } from 'react';
import type { ConvictionPulseData } from '@/lib/convictionPulse';
import type { VotePowerByEpoch } from '@/lib/data';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ConvictionPulseLineProps {
  data: ConvictionPulseData;
  powerByEpoch: VotePowerByEpoch[];
  proposedEpoch: number | null;
  expirationEpoch: number | null;
  currentEpoch: number;
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

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toFixed(0);
}

// ---------------------------------------------------------------------------
// Pulse waveform generation
// ---------------------------------------------------------------------------

interface PulsePoint {
  epoch: number;
  totalPower: number;
  yesPower: number;
  noPower: number;
  abstainPower: number;
  totalVotes: number;
  yesRatio: number; // 0-1, proportion of yes power
}

function buildPulsePoints(powerByEpoch: VotePowerByEpoch[]): PulsePoint[] {
  return powerByEpoch
    .sort((a, b) => a.epoch - b.epoch)
    .map((ep) => {
      const totalPower = ep.yesPower + ep.noPower + ep.abstainPower;
      return {
        epoch: ep.epoch,
        totalPower,
        yesPower: ep.yesPower,
        noPower: ep.noPower,
        abstainPower: ep.abstainPower,
        totalVotes: ep.yesCount + ep.noCount + ep.abstainCount,
        yesRatio: totalPower > 0 ? ep.yesPower / totalPower : 0.5,
      };
    });
}

/**
 * Generate an EKG-style SVG path for pulse points.
 *
 * For each epoch with activity, we draw a characteristic heartbeat shape:
 * baseline → small dip (P-wave) → sharp peak (QRS) → undershoot → recovery (T-wave) → baseline
 *
 * The peak height is proportional to voting power deployed that epoch.
 */
function generatePulsePath(
  points: PulsePoint[],
  width: number,
  height: number,
  proposedEpoch: number | null,
  expirationEpoch: number | null,
  currentEpoch: number,
): { path: string; segments: PulseSegment[] } {
  if (points.length === 0) {
    return {
      path: `M 0 ${height * 0.6} L ${width} ${height * 0.6}`,
      segments: [],
    };
  }

  const baseline = height * 0.65;
  const maxPeakHeight = height * 0.55;

  // Timeline: from first vote epoch to expiration (or current + 2)
  const startEpoch = proposedEpoch ?? points[0].epoch;
  const endEpoch =
    expirationEpoch ?? Math.max(currentEpoch + 2, points[points.length - 1].epoch + 2);
  const epochSpan = Math.max(1, endEpoch - startEpoch);

  // Normalize power for peak heights
  const maxPower = Math.max(1, ...points.map((p) => p.totalPower));

  const segments: PulseSegment[] = [];
  const pathParts: string[] = [];

  // Start at baseline
  pathParts.push(`M 0 ${baseline}`);

  // For each epoch in the timeline, draw flat line or pulse
  const epochWidth = width / epochSpan;
  let lastX = 0;

  for (const point of points) {
    const epochOffset = point.epoch - startEpoch;
    const centerX = (epochOffset + 0.5) * epochWidth;
    const peakHeight = (point.totalPower / maxPower) * maxPeakHeight;

    // Flat line to this epoch
    if (centerX - epochWidth * 0.4 > lastX) {
      pathParts.push(`L ${centerX - epochWidth * 0.4} ${baseline}`);
    }

    // P-wave: small dip before the main spike
    const pWaveX = centerX - epochWidth * 0.25;
    const pWaveY = baseline + peakHeight * 0.08;
    pathParts.push(`L ${pWaveX} ${pWaveY}`);

    // QRS complex: sharp spike up
    const qX = centerX - epochWidth * 0.1;
    const rX = centerX;
    const sX = centerX + epochWidth * 0.1;
    const qY = baseline + peakHeight * 0.05; // small dip before spike
    const rY = baseline - peakHeight; // peak (negative = up in SVG)
    const sY = baseline + peakHeight * 0.15; // undershoot after spike

    pathParts.push(`L ${qX} ${qY}`);
    pathParts.push(`L ${rX} ${rY}`);
    pathParts.push(`L ${sX} ${sY}`);

    // T-wave: gentle recovery bump
    const tX = centerX + epochWidth * 0.25;
    const tY = baseline - peakHeight * 0.12;
    pathParts.push(`L ${tX} ${tY}`);

    // Return to baseline
    const endX = centerX + epochWidth * 0.4;
    pathParts.push(`L ${endX} ${baseline}`);

    lastX = endX;

    segments.push({
      epoch: point.epoch,
      centerX,
      peakY: rY,
      yesRatio: point.yesRatio,
      totalPower: point.totalPower,
      totalVotes: point.totalVotes,
      yesPower: point.yesPower,
      noPower: point.noPower,
    });
  }

  // Flat line to end
  pathParts.push(`L ${width} ${baseline}`);

  return { path: pathParts.join(' '), segments };
}

interface PulseSegment {
  epoch: number;
  centerX: number;
  peakY: number;
  yesRatio: number;
  totalPower: number;
  totalVotes: number;
  yesPower: number;
  noPower: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConvictionPulseLine({
  data,
  powerByEpoch,
  proposedEpoch,
  expirationEpoch,
  currentEpoch,
  className,
}: ConvictionPulseLineProps) {
  const svgWidth = 600;
  const svgHeight = 80;

  const pulsePoints = useMemo(() => buildPulsePoints(powerByEpoch), [powerByEpoch]);

  const { path, segments } = useMemo(
    () =>
      generatePulsePath(
        pulsePoints,
        svgWidth,
        svgHeight,
        proposedEpoch,
        expirationEpoch,
        currentEpoch,
      ),
    [pulsePoints, proposedEpoch, expirationEpoch, currentEpoch],
  );

  // Compute the dominant color based on overall yes/no balance
  const totalYes = pulsePoints.reduce((s, p) => s + p.yesPower, 0);
  const totalNo = pulsePoints.reduce((s, p) => s + p.noPower, 0);
  const totalAll = totalYes + totalNo || 1;
  const overallYesRatio = totalYes / totalAll;

  // Gradient from red through neutral to green based on yes ratio
  const pulseColor =
    overallYesRatio > 0.65
      ? '#10b981' // emerald
      : overallYesRatio > 0.45
        ? '#a1a1aa' // zinc (contested)
        : '#ef4444'; // red

  const glowColor =
    overallYesRatio > 0.65
      ? 'rgba(16, 185, 129, 0.15)'
      : overallYesRatio > 0.45
        ? 'rgba(161, 161, 170, 0.1)'
        : 'rgba(239, 68, 68, 0.15)';

  // Current epoch marker position
  const startEpoch = proposedEpoch ?? pulsePoints[0]?.epoch ?? currentEpoch;
  const endEpoch =
    expirationEpoch ??
    Math.max(currentEpoch + 2, (pulsePoints[pulsePoints.length - 1]?.epoch ?? currentEpoch) + 2);
  const epochSpan = Math.max(1, endEpoch - startEpoch);
  const nowX = ((currentEpoch - startEpoch + 0.5) / epochSpan) * svgWidth;

  const hasPulseData = pulsePoints.length > 0;

  return (
    <div className={cn('rounded-xl border border-border/50 bg-card/50 p-4 space-y-3', className)}>
      {/* Metrics row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
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
          <span>{formatAda(data.totalPowerAda)} ADA</span>
        </div>
      </div>

      {/* Pulse waveform */}
      {hasPulseData ? (
        <div className="relative">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full"
            style={{ height: '80px' }}
            role="img"
            aria-label="Conviction pulse waveform showing voting activity over time"
          >
            <defs>
              {/* Glow filter for the pulse line */}
              <filter id="pulse-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Subtle baseline reference */}
            <line
              x1="0"
              y1={svgHeight * 0.65}
              x2={svgWidth}
              y2={svgHeight * 0.65}
              stroke="currentColor"
              strokeOpacity={0.06}
              strokeWidth={1}
              strokeDasharray="4 4"
            />

            {/* Area fill under the pulse */}
            <path d={`${path} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`} fill={glowColor} />

            {/* The pulse line itself */}
            <path
              d={path}
              fill="none"
              stroke={pulseColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#pulse-glow)"
            />

            {/* Per-segment peak color dots (shows yes/no balance per epoch) */}
            {segments.map((seg) => {
              const dotColor =
                seg.yesRatio > 0.65 ? '#10b981' : seg.yesRatio > 0.35 ? '#a1a1aa' : '#ef4444';
              return (
                <circle
                  key={seg.epoch}
                  cx={seg.centerX}
                  cy={seg.peakY}
                  r={3}
                  fill={dotColor}
                  fillOpacity={0.9}
                  className="transition-opacity"
                >
                  <title>
                    {`Epoch ${seg.epoch}: ${seg.totalVotes} votes, ${formatAda(seg.totalPower / 1_000_000)} ADA (${Math.round(seg.yesRatio * 100)}% Yes)`}
                  </title>
                </circle>
              );
            })}

            {/* Current epoch marker (scan line) */}
            {nowX > 0 && nowX < svgWidth && (
              <>
                <line
                  x1={nowX}
                  y1={0}
                  x2={nowX}
                  y2={svgHeight}
                  stroke={pulseColor}
                  strokeOpacity={0.3}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
                <text
                  x={nowX}
                  y={svgHeight - 2}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize="8"
                >
                  now
                </text>
              </>
            )}

            {/* Future region (after current epoch) — dimmed */}
            {nowX < svgWidth && (
              <rect
                x={nowX}
                y={0}
                width={svgWidth - nowX}
                height={svgHeight}
                fill="currentColor"
                fillOpacity={0.03}
              />
            )}
          </svg>

          {/* Summary label */}
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">{data.label}</span>
            {pulsePoints.length > 1 && (
              <span className="text-xs text-muted-foreground">
                {pulsePoints.length} epochs of activity
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-16 text-sm text-muted-foreground">
          No voting activity yet — the pulse will appear as DReps cast their votes.
        </div>
      )}
    </div>
  );
}
