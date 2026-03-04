'use client';

import { motion } from 'framer-motion';
import { useGovernanceProposalTrends } from '@/hooks/queries';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations';

interface ProposalTrend {
  dimension: string;
  direction: 'up' | 'down' | 'stable';
  magnitude: number;
  description: string;
  recentEpochAvg: number;
  olderEpochAvg: number;
}

interface TrendAnalysis {
  trends: ProposalTrend[];
  epochRange: { start: number; end: number };
  totalProposals: number;
}

const DIMENSION_LABELS: Record<string, string> = {
  dim_treasury_conservative: 'Treasury Conservative',
  dim_treasury_growth: 'Treasury Growth',
  dim_decentralization: 'Decentralization',
  dim_security: 'Security',
  dim_innovation: 'Innovation',
  dim_transparency: 'Transparency',
};

function formatDimension(dim: string): string {
  if (DIMENSION_LABELS[dim]) return DIMENSION_LABELS[dim];
  const stripped = dim.replace(/^(dim_|type_)/, '');
  return stripped
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function formatMagnitude(mag: number): number {
  if (mag >= 1) return Math.min(mag / 10, 1);
  return Math.min(mag * 5, 1);
}

export function ProposalTrends() {
  const { data: rawData, isLoading } = useGovernanceProposalTrends();
  const data = (rawData as TrendAnalysis) ?? null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const { trends = [], epochRange = { start: 0, end: 0 }, totalProposals = 0 } = data ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Evolution of Governance
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Epochs {epochRange.start}–{epochRange.end} · {totalProposals} proposals analyzed
        </p>
      </CardHeader>
      <CardContent>
        {trends.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No significant shifts detected</p>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {trends.map((trend) => (
              <TrendRow key={trend.dimension} trend={trend} />
            ))}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

function TrendRow({ trend }: { trend: ProposalTrend }) {
  const Icon =
    trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
  const colorClass =
    trend.direction === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : trend.direction === 'down'
        ? 'text-red-600 dark:text-red-400'
        : 'text-muted-foreground';
  const barColor =
    trend.direction === 'up'
      ? 'bg-emerald-500'
      : trend.direction === 'down'
        ? 'bg-red-500'
        : 'bg-muted-foreground/50';
  const barWidth = Math.max(formatMagnitude(trend.magnitude) * 100, 8);

  return (
    <motion.div variants={fadeInUp} className="rounded-lg border bg-muted/30 p-4 space-y-2">
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${colorClass}`} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{formatDimension(trend.dimension)}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{trend.description}</p>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
    </motion.div>
  );
}
