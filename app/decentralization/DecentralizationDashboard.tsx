'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import type { EDIResult } from '@/lib/ghi/ediMetrics';
import { ExternalLink } from 'lucide-react';

interface DecentralizationData {
  current: EDIResult;
  activeDrepCount: number;
  history: Array<{
    epoch_no: number;
    composite_score: number;
    nakamoto_coefficient: number;
    gini: number;
    shannon_entropy: number;
    hhi: number;
    theil_index: number;
    concentration_ratio: number;
    tau_decentralization: number;
  }>;
}

const METRIC_INFO: Record<
  string,
  { label: string; description: string; higherIsBetter: boolean; format: (v: number) => string }
> = {
  nakamotoCoefficient: {
    label: 'Nakamoto Coefficient',
    description: 'Minimum DReps controlling >50% of voting power. Higher = more decentralized.',
    higherIsBetter: true,
    format: (v) => String(v),
  },
  gini: {
    label: 'Gini Coefficient',
    description: 'Inequality of voting power distribution. Lower = more equal.',
    higherIsBetter: false,
    format: (v) => v.toFixed(3),
  },
  shannonEntropy: {
    label: 'Shannon Entropy',
    description:
      'Information diversity of power distribution (normalized 0-1). Higher = more diverse.',
    higherIsBetter: true,
    format: (v) => v.toFixed(3),
  },
  hhi: {
    label: 'HHI',
    description: 'Herfindahl-Hirschman Index — market concentration. Lower = more competitive.',
    higherIsBetter: false,
    format: (v) => v.toLocaleString(),
  },
  theilIndex: {
    label: 'Theil Index',
    description: 'Decomposable inequality measure. Lower = more equal distribution.',
    higherIsBetter: false,
    format: (v) => v.toFixed(3),
  },
  concentrationRatio: {
    label: '1 - Concentration',
    description: "1 minus the largest DRep's share. Higher = less concentrated.",
    higherIsBetter: true,
    format: (v) => v.toFixed(3),
  },
  tauDecentralization: {
    label: 'Tau-Decentralization',
    description: 'DReps needed for 66% supermajority. Relevant to Cardano governance thresholds.',
    higherIsBetter: true,
    format: (v) => String(v),
  },
};

function getScoreBand(score: number): { label: string; color: string } {
  if (score >= 76) return { label: 'Highly Decentralized', color: '#10b981' };
  if (score >= 51) return { label: 'Moderately Decentralized', color: '#06b6d4' };
  if (score >= 26) return { label: 'Partially Centralized', color: '#f59e0b' };
  return { label: 'Highly Centralized', color: '#ef4444' };
}

export function DecentralizationDashboard() {
  const [data, setData] = useState<DecentralizationData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/governance/decentralization')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d ? setData(d) : setError(true)))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Unable to load decentralization metrics. Please try again later.
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-lg bg-muted/30 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-muted/20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const band = getScoreBand(data.current.compositeScore);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Hero: Composite Score */}
      <motion.div variants={fadeInUp}>
        <Card className="overflow-hidden">
          <CardContent className="p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative">
                <div
                  className="w-28 h-28 rounded-full flex items-center justify-center border-4"
                  style={{ borderColor: band.color }}
                >
                  <span className="text-4xl font-bold tabular-nums" style={{ color: band.color }}>
                    {data.current.compositeScore}
                  </span>
                </div>
              </div>
              <div className="text-center sm:text-left space-y-2">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <h2 className="text-xl font-semibold">Governance Decentralization Score</h2>
                  <Badge variant="outline" style={{ borderColor: band.color, color: band.color }}>
                    {band.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground max-w-md">
                  Composite of 7 EDI metrics applied to {data.activeDrepCount} active DRep voting
                  power distributions. Scale: 0 (fully centralized) to 100 (fully decentralized).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 7-Metric Breakdown */}
      <motion.div variants={fadeInUp}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Object.entries(METRIC_INFO).map(([key, info]) => {
            const value = data.current.breakdown[key as keyof typeof data.current.breakdown];
            const normalizedValue =
              data.current.normalized[key as keyof typeof data.current.normalized];

            return (
              <MetricCard
                key={key}
                label={info.label}
                value={info.format(value as number)}
                normalizedScore={Math.round((normalizedValue ?? 0) * 100)}
                description={info.description}
                higherIsBetter={info.higherIsBetter}
                history={data.history.map((h) => {
                  const histKey = keyToSnakeCase(key);
                  return (h as any)[histKey] as number;
                })}
              />
            );
          })}
        </div>
      </motion.div>

      {/* Attribution */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-2">Methodology</h3>
            <p className="text-sm text-muted-foreground">
              Based on the{' '}
              <a
                href="https://informatics.ed.ac.uk/blockchain/edi"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Edinburgh Decentralization Index
                <ExternalLink className="h-3 w-3" />
              </a>{' '}
              by the University of Edinburgh. The EDI provides a multi-metric framework for
              measuring decentralization across blockchain systems. We apply all 7 core metrics
              specifically to Cardano&apos;s on-chain governance voting power distribution.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function MetricCard({
  label,
  value,
  normalizedScore,
  description,
  higherIsBetter,
  history,
}: {
  label: string;
  value: string;
  normalizedScore: number;
  description: string;
  higherIsBetter: boolean;
  history: number[];
}) {
  const color =
    normalizedScore >= 70
      ? '#10b981'
      : normalizedScore >= 40
        ? '#06b6d4'
        : normalizedScore >= 20
          ? '#f59e0b'
          : '#ef4444';

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>{label}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5">
            {higherIsBetter ? '↑ better' : '↓ better'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground">({normalizedScore}/100 normalized)</span>
        </div>

        {/* Mini bar */}
        <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${normalizedScore}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>

        {/* Sparkline */}
        {history.length >= 2 && <MiniSparkline values={history} color={color} />}

        <p className="text-[11px] text-muted-foreground leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const W = 120;
  const H = 20;
  const PAD = 2;

  const points = useMemo(() => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values.map((v, i) => ({
      x: PAD + (i / (values.length - 1)) * (W - PAD * 2),
      y: PAD + (1 - (v - min) / range) * (H - PAD * 2),
    }));
  }, [values]);

  if (points.length < 2) return null;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full">
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.6}
      />
    </svg>
  );
}

function keyToSnakeCase(key: string): string {
  const map: Record<string, string> = {
    nakamotoCoefficient: 'nakamoto_coefficient',
    gini: 'gini',
    shannonEntropy: 'shannon_entropy',
    hhi: 'hhi',
    theilIndex: 'theil_index',
    concentrationRatio: 'concentration_ratio',
    tauDecentralization: 'tau_decentralization',
  };
  return map[key] ?? key;
}
