'use client';

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Thermometer } from 'lucide-react';

interface TemperatureData {
  epoch: number;
  temperature: number;
  components: {
    engagementVolume: number;
    sentimentPolarization: number;
    proposalVelocity: number;
    participationRate: number;
  };
  band: 'cold' | 'cool' | 'warm' | 'hot';
  updatedAt: string;
}

async function fetchTemperature(): Promise<TemperatureData | null> {
  const res = await fetch('/api/community/temperature');
  if (!res.ok) return null;
  return res.json();
}

const BAND_CONFIG = {
  cold: { color: 'text-blue-400', bg: 'bg-blue-400', label: 'Cold', desc: 'Low activity' },
  cool: { color: 'text-cyan-400', bg: 'bg-cyan-400', label: 'Cool', desc: 'Moderate activity' },
  warm: { color: 'text-amber-400', bg: 'bg-amber-400', label: 'Warm', desc: 'Active governance' },
  hot: {
    color: 'text-rose-500',
    bg: 'bg-rose-500',
    label: 'Hot',
    desc: 'High activity + polarization',
  },
} as const;

const COMPONENT_LABELS: Record<string, string> = {
  engagementVolume: 'Engagement',
  sentimentPolarization: 'Polarization',
  proposalVelocity: 'Proposals',
  participationRate: 'Participation',
};

export function GovernanceTemperature() {
  const { data, isLoading } = useQuery({
    queryKey: ['governance-temperature'],
    queryFn: fetchTemperature,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <TemperatureSkeleton />;
  }

  if (!data) {
    return null;
  }

  const config = BAND_CONFIG[data.band];

  return (
    <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Thermometer className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">Governance Pulse</h3>
        </div>
        <span className="text-xs text-muted-foreground">Epoch {data.epoch}</span>
      </div>

      {/* Main gauge */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className={cn('text-4xl font-bold tabular-nums', config.color)}>
            {data.temperature}
          </div>
          <div className={cn('text-xs font-medium', config.color)}>{config.label}</div>
        </div>

        <div className="flex-1 space-y-1.5">
          {/* Temperature bar */}
          <div className="relative h-3 w-full rounded-full bg-gradient-to-r from-blue-400/20 via-amber-400/20 to-rose-500/20 overflow-hidden">
            <div
              className={cn(
                'absolute inset-y-0 left-0 rounded-full transition-all duration-700',
                config.bg,
              )}
              style={{ width: `${data.temperature}%`, opacity: 0.8 }}
            />
            {/* Indicator dot */}
            <div
              className={cn(
                'absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-background shadow-sm transition-all duration-700',
                config.bg,
              )}
              style={{ left: `calc(${Math.min(data.temperature, 96)}% - 8px)` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Cold</span>
            <span>Cool</span>
            <span>Warm</span>
            <span>Hot</span>
          </div>
        </div>
      </div>

      {/* Component breakdown */}
      <div className="grid grid-cols-2 gap-2">
        {(Object.entries(data.components) as [string, number][]).map(([key, value]) => (
          <div key={key} className="rounded-lg bg-muted/30 px-3 py-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">{COMPONENT_LABELS[key] ?? key}</span>
              <span className="text-sm font-semibold tabular-nums">
                {value}
                <span className="text-xs text-muted-foreground">/25</span>
              </span>
            </div>
            <div className="mt-1 h-1 w-full rounded-full bg-primary/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/60 transition-all duration-500"
                style={{ width: `${(value / 25) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemperatureSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-muted animate-pulse" />
        <div className="h-4 w-36 rounded bg-muted animate-pulse" />
      </div>
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded bg-muted animate-pulse" />
        <div className="flex-1 h-3 rounded-full bg-muted animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}
