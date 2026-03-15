'use client';

import { useMemo, useId, useRef, useEffect, useCallback } from 'react';
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
// Heartbeat waveform generation
// ---------------------------------------------------------------------------

interface BeatPosition {
  epoch: number;
  x: number;
  peakY: number;
  intensity: number;
  yesRatio: number;
  totalPower: number;
  totalVotes: number;
}

function generateHeartbeat(
  powerByEpoch: VotePowerByEpoch[],
  width: number,
  height: number,
  proposedEpoch: number | null,
  expirationEpoch: number | null,
  currentEpoch: number,
): { mainPath: string; totalLength: number; beatPositions: BeatPosition[] } {
  const baseline = height * 0.55;
  const sorted = [...powerByEpoch].sort((a, b) => a.epoch - b.epoch);

  if (sorted.length === 0) {
    const path = `M 0 ${baseline} L ${width} ${baseline}`;
    return { mainPath: path, totalLength: width, beatPositions: [] };
  }

  const startEpoch = proposedEpoch ?? sorted[0].epoch;
  const endEpoch =
    expirationEpoch ?? Math.max(currentEpoch + 2, sorted[sorted.length - 1].epoch + 2);
  const epochSpan = Math.max(1, endEpoch - startEpoch);
  const pxPerEpoch = width / epochSpan;

  const maxPower = Math.max(1, ...sorted.map((p) => p.yesPower + p.noPower + p.abstainPower));

  const beatPositions: BeatPosition[] = [];
  const parts: string[] = [];
  parts.push(`M 0 ${baseline}`);

  let currentX = 0;

  for (const epoch of sorted) {
    const totalPower = epoch.yesPower + epoch.noPower + epoch.abstainPower;
    const intensity = Math.max(0.35, totalPower / maxPower);
    const peakAmplitude = height * 0.42 * intensity;

    const epochX = ((epoch.epoch - startEpoch + 0.5) / epochSpan) * width;
    const beatWidth = Math.max(pxPerEpoch * 0.7, 50);
    const halfBeat = beatWidth / 2;

    // Flatline to beat start
    const beatStart = epochX - halfBeat;
    if (beatStart > currentX + 2) {
      parts.push(`L ${beatStart} ${baseline}`);
    }

    // P-wave: gentle bump
    const pStart = beatStart;
    const pPeak = pStart + halfBeat * 0.25;
    const pEnd = pStart + halfBeat * 0.4;
    parts.push(`L ${pStart} ${baseline}`);
    parts.push(`Q ${pPeak} ${baseline - peakAmplitude * 0.12} ${pEnd} ${baseline}`);

    // QRS complex: the dramatic spike
    const qPoint = pEnd + halfBeat * 0.05;
    const rPoint = epochX;
    const sPoint = epochX + halfBeat * 0.15;
    parts.push(`L ${qPoint} ${baseline + peakAmplitude * 0.08}`);
    parts.push(`L ${rPoint} ${baseline - peakAmplitude}`);
    parts.push(`L ${sPoint} ${baseline + peakAmplitude * 0.22}`);

    // T-wave: recovery bump
    const tPeak = sPoint + halfBeat * 0.25;
    const tEnd = sPoint + halfBeat * 0.45;
    parts.push(`Q ${tPeak} ${baseline - peakAmplitude * 0.15} ${tEnd} ${baseline}`);

    currentX = tEnd;

    const yesRatio = totalPower > 0 ? epoch.yesPower / totalPower : 0.5;

    beatPositions.push({
      epoch: epoch.epoch,
      x: epochX,
      peakY: baseline - peakAmplitude,
      intensity,
      yesRatio,
      totalPower,
      totalVotes: epoch.yesCount + epoch.noCount + epoch.abstainCount,
    });
  }

  parts.push(`L ${width} ${baseline}`);
  const totalLength = width * 1.5 + sorted.length * 120;

  return { mainPath: parts.join(' '), totalLength, beatPositions };
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
  const uniqueId = useId();
  const svgWidth = 800;
  const svgHeight = 100;

  const mainPathRef = useRef<SVGPathElement>(null);
  const glowPathRef = useRef<SVGPathElement>(null);

  const { mainPath, beatPositions } = useMemo(
    () =>
      generateHeartbeat(
        powerByEpoch,
        svgWidth,
        svgHeight,
        proposedEpoch,
        expirationEpoch,
        currentEpoch,
      ),
    [powerByEpoch, proposedEpoch, expirationEpoch, currentEpoch],
  );

  // Color based on overall vote balance
  const totalYes = powerByEpoch.reduce((s, p) => s + p.yesPower, 0);
  const totalNo = powerByEpoch.reduce((s, p) => s + p.noPower, 0);
  const totalAll = totalYes + totalNo || 1;
  const yesRatio = totalYes / totalAll;

  const pulseColor = yesRatio > 0.6 ? '#10b981' : yesRatio > 0.4 ? '#8b5cf6' : '#ef4444';

  // Scan line position
  const startEpoch = proposedEpoch ?? powerByEpoch[0]?.epoch ?? currentEpoch;
  const endEpoch =
    expirationEpoch ??
    Math.max(currentEpoch + 2, (powerByEpoch[powerByEpoch.length - 1]?.epoch ?? currentEpoch) + 2);
  const epochSpan = Math.max(1, endEpoch - startEpoch);
  const nowX = ((currentEpoch - startEpoch + 0.5) / epochSpan) * svgWidth;

  const hasPulseData = powerByEpoch.length > 0;
  const cssId = uniqueId.replace(/:/g, '');

  // Animate path drawing + continuous glow pulse via Web Animations API
  useEffect(() => {
    if (!hasPulseData) return;
    const path = mainPathRef.current;
    const glow = glowPathRef.current;
    if (!path) return;

    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    path.animate([{ strokeDashoffset: `${length}` }, { strokeDashoffset: '0' }], {
      duration: 2500,
      easing: 'ease-out',
      fill: 'forwards',
    });

    if (glow) {
      const gl = glow.getTotalLength();
      glow.style.strokeDasharray = `${gl}`;
      glow.style.strokeDashoffset = `${gl}`;
      glow.animate([{ strokeDashoffset: `${gl}` }, { strokeDashoffset: '0' }], {
        duration: 2500,
        easing: 'ease-out',
        fill: 'forwards',
      });
    }

    // After draw completes, start continuous pulsing
    const t = setTimeout(() => {
      path.animate([{ opacity: 1 }, { opacity: 0.5 }, { opacity: 1 }], {
        duration: 3000,
        iterations: Infinity,
        easing: 'ease-in-out',
      });
      glow?.animate([{ opacity: 0.25 }, { opacity: 0.5 }, { opacity: 0.25 }], {
        duration: 3000,
        iterations: Infinity,
        easing: 'ease-in-out',
      });
    }, 2600);

    return () => clearTimeout(t);
  }, [hasPulseData, mainPath]);

  // Scan line pulsing via callback ref
  const scanCallback = useCallback((el: SVGRectElement | null) => {
    if (!el) return;
    el.animate([{ opacity: '0.15' }, { opacity: '0.8' }, { opacity: '0.15' }], {
      duration: 2000,
      iterations: Infinity,
      easing: 'ease-in-out',
    });
  }, []);

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
          <span>{formatAda(data.totalPowerAda)} ADA</span>
        </div>
      </div>

      {/* Animated pulse waveform */}
      <div className="relative px-2 pb-3">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full"
          style={{ height: '100px' }}
          role="img"
          aria-label="Conviction pulse — heartbeat waveform showing voting activity over time"
        >
          <defs>
            <filter id={`gl${cssId}`} x="-10%" y="-30%" width="120%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id={`og${cssId}`} x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            </filter>
            <linearGradient id={`sg${cssId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={pulseColor} stopOpacity="0" />
              <stop offset="40%" stopColor={pulseColor} stopOpacity="0.5" />
              <stop offset="60%" stopColor={pulseColor} stopOpacity="0.5" />
              <stop offset="100%" stopColor={pulseColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Monitor grid */}
          <g opacity="0.04" stroke="currentColor">
            {Array.from({ length: 9 }, (_, i) => (
              <line
                key={`h${i}`}
                x1="0"
                y1={(i + 1) * 10}
                x2={svgWidth}
                y2={(i + 1) * 10}
                strokeWidth="0.5"
              />
            ))}
            {Array.from({ length: 15 }, (_, i) => (
              <line
                key={`v${i}`}
                x1={(i + 1) * (svgWidth / 16)}
                y1="0"
                x2={(i + 1) * (svgWidth / 16)}
                y2={svgHeight}
                strokeWidth="0.5"
              />
            ))}
          </g>

          {/* Outer glow (blurred shadow of the line) */}
          {hasPulseData && (
            <path
              ref={glowPathRef}
              d={mainPath}
              fill="none"
              stroke={pulseColor}
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#og${cssId})`}
              opacity={0.25}
            />
          )}

          {/* Main animated pulse line */}
          <path
            ref={mainPathRef}
            d={mainPath}
            fill="none"
            stroke={pulseColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#gl${cssId})`}
          />

          {/* Beat peak dots with glow rings */}
          {beatPositions.map((beat) => {
            const dotColor =
              beat.yesRatio > 0.6 ? '#10b981' : beat.yesRatio > 0.4 ? '#8b5cf6' : '#ef4444';
            return (
              <g key={beat.epoch}>
                <circle
                  cx={beat.x}
                  cy={beat.peakY}
                  r={7}
                  fill="none"
                  stroke={dotColor}
                  strokeWidth={1}
                  opacity={0.3}
                />
                <circle cx={beat.x} cy={beat.peakY} r={3.5} fill={dotColor}>
                  <title>
                    {`Epoch ${beat.epoch}: ${beat.totalVotes} votes, ${formatAda(beat.totalPower / 1_000_000)} ADA (${Math.round(beat.yesRatio * 100)}% Yes)`}
                  </title>
                </circle>
              </g>
            );
          })}

          {/* Pulsing scan line at current epoch */}
          {nowX > 0 && nowX < svgWidth && (
            <rect
              ref={scanCallback}
              x={nowX - 1.5}
              y={0}
              width={3}
              height={svgHeight}
              fill={`url(#sg${cssId})`}
            />
          )}

          {/* Dimmed future region */}
          {nowX > 0 && nowX < svgWidth && (
            <rect
              x={nowX}
              y={0}
              width={svgWidth - nowX}
              height={svgHeight}
              fill="currentColor"
              fillOpacity={0.04}
            />
          )}
        </svg>

        {/* Label row */}
        <div className="flex items-center justify-between px-3 mt-0.5">
          <span className="text-xs text-muted-foreground">{data.label}</span>
          {beatPositions.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {beatPositions.length} epoch{beatPositions.length !== 1 ? 's' : ''} of activity
            </span>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!hasPulseData && (
        <div className="px-5 pb-4 -mt-2">
          <p className="text-sm text-muted-foreground text-center">
            The pulse will appear as DReps cast their votes.
          </p>
        </div>
      )}
    </div>
  );
}
