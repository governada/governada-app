'use client';

import { motion } from 'framer-motion';
import { fadeInUp, spring } from '@/lib/animations';
import { TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';
import { CHAIN_IDENTITIES, getGradeColor, type Chain } from '@/lib/crossChain';

interface ChainData {
  chain: Chain;
  participationRate: number | null;
  delegateCount: number | null;
  proposalCount: number | null;
  governanceScore: number | null;
  grade: string | null;
  fetchedAt: string | null;
}

interface HistoryPoint {
  periodLabel: string;
  score: number | null;
  grade: string | null;
}

interface CrossChainReportCardProps {
  data: ChainData;
  history?: HistoryPoint[];
  className?: string;
}

export function CrossChainReportCard({ data, history = [], className = '' }: CrossChainReportCardProps) {
  const identity = CHAIN_IDENTITIES[data.chain];
  const grade = data.grade ?? '—';
  const gradeColor = data.grade ? getGradeColor(data.grade) : '#6b7280';
  const score = data.governanceScore ?? 0;

  const prevScore = history.length >= 2 ? history[history.length - 2]?.score : null;
  const trend = prevScore != null && data.governanceScore != null
    ? data.governanceScore > prevScore ? 'up' : data.governanceScore < prevScore ? 'down' : 'flat'
    : null;

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
      {/* Top glow line */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${identity.color}40, transparent)` }}
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
          <p className="text-xs text-muted-foreground">Governance Health</p>
        </div>
      </div>

      {/* Grade */}
      <div className="mb-4 flex items-end gap-3">
        <motion.span
          className="text-5xl font-black tracking-tight"
          style={{ color: gradeColor }}
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ ...spring.bouncy, delay: 0.1 }}
        >
          {grade}
        </motion.span>
        <div className="mb-1 flex flex-col gap-1">
          <span className="text-lg font-semibold tabular-nums text-muted-foreground">{score}/100</span>
          {trend && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${
              trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
            }`}>
              {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable'}
            </span>
          )}
        </div>
      </div>

      {/* Mini sparkline */}
      {history.length > 1 && (
        <div className="mb-4">
          <MiniSparkline
            data={history.map(h => h.score ?? 0)}
            color={identity.color}
            height={28}
          />
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <MetricCell label="Participation" value={data.participationRate != null ? `${data.participationRate}%` : '—'} />
        <MetricCell label="Delegates" value={data.delegateCount != null ? formatNumber(data.delegateCount) : '—'} />
        <MetricCell label="Proposals" value={data.proposalCount != null ? formatNumber(data.proposalCount) : '—'} />
      </div>

      {data.chain !== 'cardano' && (
        <div className="mt-3 flex justify-end">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
            <ExternalLink className="h-2.5 w-2.5" />
            {data.chain === 'ethereum' ? 'via Tally' : 'via SubSquare'}
          </span>
        </div>
      )}
    </motion.div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function MiniSparkline({ data, color, height = 28 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null;

  const width = 140;
  const max = Math.max(...data, 100);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padding = 2;

  const points = data.map((v, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: padding + (1 - (v - min) / range) * (height - padding * 2),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#spark-${color.replace('#', '')})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
