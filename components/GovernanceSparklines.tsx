'use client';

import { motion } from 'framer-motion';
import { useGovernanceSparklines } from '@/hooks/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type ParticipationRow = { epoch: number; participation_rate: number; rationale_rate: number };
type TreasuryRow = {
  epoch: number;
  health_score: number;
  runway_months: number;
  burn_rate_per_epoch: number;
};
type DecentralizationRow = {
  epoch_no: number;
  composite_score: number;
  nakamoto_coefficient: number;
  active_drep_count: number;
};

type SparklinesData = {
  participation: ParticipationRow[];
  treasury: TreasuryRow[];
  decentralization: DecentralizationRow[];
};

function SparklineSvg({
  values,
  width = 120,
  height = 32,
  strokeColor = 'currentColor',
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 2;
  const w = width - padding * 2;
  const h = height - padding * 2;
  const stepX = values.length > 1 ? w / (values.length - 1) : 0;
  const points = values
    .map((v, i) => {
      const x = padding + i * stepX;
      const y = padding + h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-amber-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function getTrend(values: number[]): 'up' | 'down' | 'flat' {
  if (values.length < 2) return 'flat';
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  const diff = last - prev;
  if (diff > 0) return 'up';
  if (diff < 0) return 'down';
  return 'flat';
}

export function GovernanceSparklines() {
  const { data: rawData, isLoading } = useGovernanceSparklines();
  const data = (rawData as SparklinesData) ?? null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Governance Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const participation = data?.participation ?? [];
  const treasury = data?.treasury ?? [];
  const decentralization = data?.decentralization ?? [];

  const allEmpty =
    participation.length === 0 && treasury.length === 0 && decentralization.length === 0;
  if (allEmpty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Governance Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No historical data yet</p>
        </CardContent>
      </Card>
    );
  }

  const partValues = participation.map((r) => r.participation_rate);
  const partTrend = getTrend(partValues);
  const treasuryValues = treasury.map((r) => r.health_score);
  const treasuryTrend = getTrend(treasuryValues);
  const decentralValues = decentralization.map((r) => r.composite_score);
  const decentralTrend = getTrend(decentralValues);

  const partStroke =
    partTrend === 'up' ? 'rgb(34 197 94)' : partTrend === 'down' ? 'rgb(245 158 11)' : undefined;
  const treasuryStroke =
    treasuryTrend === 'up'
      ? 'rgb(34 197 94)'
      : treasuryTrend === 'down'
        ? 'rgb(245 158 11)'
        : undefined;
  const decentralStroke =
    decentralTrend === 'up'
      ? 'rgb(34 197 94)'
      : decentralTrend === 'down'
        ? 'rgb(245 158 11)'
        : undefined;

  const partEpochRange =
    participation.length >= 2
      ? `Epochs ${participation[0].epoch}–${participation[participation.length - 1].epoch}`
      : participation.length === 1
        ? `Epoch ${participation[0].epoch}`
        : '';
  const treasuryEpochRange =
    treasury.length >= 2
      ? `Epochs ${treasury[0].epoch}–${treasury[treasury.length - 1].epoch}`
      : treasury.length === 1
        ? `Epoch ${treasury[0].epoch}`
        : '';
  const decentralEpochRange =
    decentralization.length >= 2
      ? `Epochs ${decentralization[0].epoch_no}–${decentralization[decentralization.length - 1].epoch_no}`
      : decentralization.length === 1
        ? `Epoch ${decentralization[0].epoch_no}`
        : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Governance Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs">Participation Rate</span>
              <div className="flex items-center gap-1">
                <span className="font-medium tabular-nums">
                  {participation.length
                    ? `${(participation[participation.length - 1].participation_rate * 100).toFixed(1)}%`
                    : '—'}
                </span>
                <TrendIcon trend={partTrend} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SparklineSvg values={partValues} strokeColor={partStroke} />
              <span className="text-muted-foreground shrink-0 text-xs">{partEpochRange}</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs">Treasury Health</span>
              <div className="flex items-center gap-1">
                <span className="font-medium tabular-nums">
                  {treasury.length ? treasury[treasury.length - 1].health_score.toFixed(1) : '—'}
                </span>
                {treasury.length ? (
                  <span className="text-muted-foreground text-xs">
                    ({treasury[treasury.length - 1].runway_months}mo runway)
                  </span>
                ) : null}
                <TrendIcon trend={treasuryTrend} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SparklineSvg values={treasuryValues} strokeColor={treasuryStroke} />
              <span className="text-muted-foreground shrink-0 text-xs">{treasuryEpochRange}</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs">Decentralization</span>
              <div className="flex items-center gap-1">
                <span className="font-medium tabular-nums">
                  {decentralization.length
                    ? decentralization[decentralization.length - 1].nakamoto_coefficient
                    : '—'}
                </span>
                <span className="text-muted-foreground text-xs">Nakamoto</span>
                <TrendIcon trend={decentralTrend} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SparklineSvg values={decentralValues} strokeColor={decentralStroke} />
              <span className="text-muted-foreground shrink-0 text-xs">{decentralEpochRange}</span>
            </div>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}
