'use client';

import { useState, useEffect, useRef, useId } from 'react';

interface ForceBeamProps {
  yesPct: number;
  noPct: number;
  /** Optional: compact mode for inline rendering */
  compact?: boolean;
  className?: string;
}

/**
 * Inline SVG tug-of-war force beam.
 * Extracted from ConvictionTugOfWar for reuse in the VerdictStrip.
 */
export function ForceBeam({ yesPct, noPct, compact = false, className }: ForceBeamProps) {
  const cssId = useId().replace(/:/g, '');
  const balancePoint = yesPct + noPct > 0 ? noPct / (yesPct + noPct) : 0.5;

  // Animate in
  const [progress, setProgress] = useState(0);
  const animRef = useRef(false);
  useEffect(() => {
    if (animRef.current) return;
    animRef.current = true;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / 1200);
      setProgress(1 - Math.pow(1 - t, 3));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, []);

  const svgWidth = 600;
  const beamHeight = compact ? 16 : 20;
  const svgHeight = beamHeight + 8;
  const beamY = 4;
  const clashX = balancePoint * svgWidth;
  const noWidth = clashX * progress;
  const yesWidth = (svgWidth - clashX) * progress;

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className={className}
      style={{ height: compact ? '20px' : '24px', width: '100%' }}
      role="img"
      aria-label={`Voting power: ${Math.round(yesPct)}% Yes, ${Math.round(noPct)}% No`}
    >
      <defs>
        <linearGradient id={`no-fb-${cssId}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.85} />
          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} />
        </linearGradient>
        <linearGradient id={`yes-fb-${cssId}`} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#10b981" stopOpacity={0.85} />
          <stop offset="100%" stopColor="#10b981" stopOpacity={0.4} />
        </linearGradient>
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

      {/* No side */}
      <rect
        x={clashX - noWidth}
        y={beamY}
        width={noWidth}
        height={beamHeight}
        rx={noWidth > beamHeight ? beamHeight / 2 : noWidth / 2}
        fill={`url(#no-fb-${cssId})`}
      />

      {/* Yes side */}
      <rect
        x={clashX}
        y={beamY}
        width={yesWidth}
        height={beamHeight}
        rx={yesWidth > beamHeight ? beamHeight / 2 : yesWidth / 2}
        fill={`url(#yes-fb-${cssId})`}
      />

      {/* Clash point */}
      {progress > 0.8 && (
        <circle cx={clashX} cy={beamY + beamHeight / 2} r={3} fill="currentColor" opacity={0.5} />
      )}
    </svg>
  );
}
