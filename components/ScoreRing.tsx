'use client';

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

function getTierColor(score: number) {
  if (score >= 80) return { stroke: '#22c55e', label: 'Strong' };
  if (score >= 60) return { stroke: '#f59e0b', label: 'Good' };
  return { stroke: '#ef4444', label: 'Low' };
}

export function ScoreRing({ score, size = 140, strokeWidth = 10 }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score)) / 100;
  const dashOffset = circumference * (1 - progress);
  const { stroke, label } = getTierColor(score);

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Score: ${score} out of 100, ${label}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/40"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Center text overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums leading-none" style={{ color: stroke }}>
          {score}
        </span>
        <span className="text-[11px] font-medium text-muted-foreground mt-0.5">{label}</span>
      </div>
    </div>
  );
}
