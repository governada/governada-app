'use client';

const QUALITY_COLORS = [
  { threshold: 100, bg: 'bg-emerald-500', label: 'Complete' },
  { threshold: 75, bg: 'bg-[var(--compass-teal)]', label: 'Strong' },
  { threshold: 50, bg: 'bg-amber-500', label: 'Partial' },
  { threshold: 0, bg: 'bg-red-500', label: 'Early' },
];

function getQualityConfig(completeness: number) {
  return QUALITY_COLORS.find((c) => completeness >= c.threshold) ?? QUALITY_COLORS[3];
}

export function QualityCell({ completeness }: { completeness: number }) {
  const config = getQualityConfig(completeness);

  return (
    <div className="flex items-center gap-2">
      {/* 4-dot indicator */}
      <div className="flex gap-0.5">
        {[0, 25, 50, 75].map((threshold) => (
          <div
            key={threshold}
            className={`h-1.5 w-1.5 rounded-full ${
              completeness > threshold ? config.bg : 'bg-muted-foreground/20'
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{config.label}</span>
    </div>
  );
}
