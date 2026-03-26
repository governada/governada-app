'use client';

interface HudEpochArcProps {
  progress: number;
  className?: string;
}

export function HudEpochArc({ progress, className }: HudEpochArcProps) {
  const clampedProgress = Math.max(0, Math.min(progress, 1));

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 h-[3px] pointer-events-none ${className ?? ''}`}
    >
      {/* Track */}
      <div className="absolute inset-0 bg-[oklch(1_0_0/0.05)]" />

      {/* Fill */}
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-1000 ease-out"
        style={{
          width: `${clampedProgress * 100}%`,
          backgroundColor: 'oklch(0.72 0.12 192)',
          boxShadow: '0 0 8px oklch(0.72 0.12 192 / 0.6), 0 0 20px oklch(0.72 0.12 192 / 0.3)',
        }}
      />
    </div>
  );
}
