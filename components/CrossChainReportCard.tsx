'use client';

import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { Info } from 'lucide-react';
import { CHAIN_IDENTITIES, type ChainBenchmark } from '@/lib/crossChain';
import {
  getChainMetrics,
  GOVERNANCE_MODELS,
  type ChainMetric,
} from '@/lib/crossChain/chainMetrics';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CrossChainReportCardProps {
  benchmark: ChainBenchmark;
  className?: string;
}

export function CrossChainReportCard({ benchmark, className = '' }: CrossChainReportCardProps) {
  const identity = CHAIN_IDENTITIES[benchmark.chain];
  const model = GOVERNANCE_MODELS[benchmark.chain];
  const metrics = getChainMetrics(benchmark);

  const freshness = benchmark.fetchedAt ? formatFreshness(benchmark.fetchedAt) : null;

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      className={`relative overflow-hidden rounded-xl border bg-card/50 p-5 transition-all hover:bg-card/80 ${className}`}
      style={{
        borderColor: `${identity.color}20`,
        boxShadow: `0 0 20px ${identity.color}08, inset 0 1px 0 ${identity.color}10`,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${identity.color}40, transparent)`,
        }}
      />

      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
          style={{ backgroundColor: `${identity.color}15`, color: identity.color }}
        >
          {identity.name[0]}
        </div>
        <div>
          <h3 className="text-sm font-semibold">{identity.name}</h3>
          <p className="text-xs text-muted-foreground">{model.tagline}</p>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {metrics.slice(0, 6).map((metric) => (
          <MetricCell key={metric.key} metric={metric} chainColor={identity.color} />
        ))}
      </div>

      {/* Governance model blurb */}
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground/70">
        {model.description}
      </p>

      {/* Data source + freshness */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
        <span>Data from {model.source}</span>
        {freshness && <span>Updated {freshness}</span>}
      </div>
    </motion.div>
  );
}

function MetricCell({ metric, chainColor }: { metric: ChainMetric; chainColor: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        <span className="truncate text-[11px] text-muted-foreground">{metric.label}</span>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 shrink-0 cursor-help text-muted-foreground/70" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-xs">
              {metric.context}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="text-sm font-semibold tabular-nums" style={{ color: chainColor }}>
        {formatMetricValue(metric.value)}
      </div>
    </div>
  );
}

function formatMetricValue(value: number | string | null): string {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatFreshness(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
