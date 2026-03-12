'use client';

import { motion } from 'framer-motion';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { spring } from '@/lib/animations';

interface TrajectoryCardProps {
  scoreHistory: { date: string; score: number }[];
  delegationTrend: { epoch: number; votingPowerAda: number; delegatorCount: number }[];
  currentScore: number;
  scoreMomentum: number | null;
  delegatorCount: number;
  votingPowerFormatted: string;
}

function ScoreSparkline({ data }: { data: { date: string; score: number }[] }) {
  if (data.length < 2) return null;

  const width = 120;
  const height = 32;
  const padding = 2;
  const scores = data.map((d) => d.score);
  const minScore = Math.min(...scores) - 2;
  const maxScore = Math.max(...scores) + 2;
  const range = maxScore - minScore || 1;

  const points = data
    .map((d, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = padding + (1 - (d.score - minScore) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  const trend = scores[scores.length - 1] - scores[0];
  const color = trend > 0 ? '#10b981' : trend < 0 ? '#f43f5e' : '#a1a1aa';

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function generateScoreNarrative(data: { date: string; score: number }[]): string {
  if (data.length < 2) return '';

  const first = data[0];
  const last = data[data.length - 1];
  const diff = last.score - first.score;
  const days = Math.max(
    1,
    Math.round(
      (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  if (Math.abs(diff) <= 1) {
    return `Stable at ${last.score} for ${days} days`;
  }
  return diff > 0
    ? `Score rose from ${first.score} to ${last.score} over ${days} days`
    : `Score declined from ${first.score} to ${last.score} over ${days} days`;
}

function generateDelegationNarrative(data: { epoch: number; delegatorCount: number }[]): string {
  if (data.length < 2) return '';

  const first = data[0];
  const last = data[data.length - 1];
  const epochs = last.epoch - first.epoch;
  const diff = last.delegatorCount - first.delegatorCount;

  if (first.delegatorCount === 0 && last.delegatorCount === 0) {
    return 'No delegation activity recorded yet';
  }

  if (diff === 0) {
    return `Steady delegation base of ${last.delegatorCount.toLocaleString()} delegators`;
  }

  const pctChange =
    first.delegatorCount > 0 ? Math.round((diff / first.delegatorCount) * 100) : null;

  if (diff > 0) {
    return pctChange != null
      ? `Delegation grew ${pctChange}% over ${epochs} epochs`
      : `Grew to ${last.delegatorCount.toLocaleString()} delegators over ${epochs} epochs`;
  }

  return pctChange != null
    ? `Delegation declined ${Math.abs(pctChange)}% over ${epochs} epochs`
    : `Declined to ${last.delegatorCount.toLocaleString()} delegators over ${epochs} epochs`;
}

export function TrajectoryCard({
  scoreHistory,
  delegationTrend,
  currentScore,
  scoreMomentum,
  delegatorCount,
  votingPowerFormatted,
}: TrajectoryCardProps) {
  const hasScoreData = scoreHistory.length >= 2;
  const hasDelegationData = delegationTrend.length >= 2;

  if (!hasScoreData && !hasDelegationData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.smooth}
        className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5 py-5 space-y-2"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Trajectory
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Trajectory data builds as this DRep participates in governance. Check back after a few
          epochs.
        </p>
      </motion.div>
    );
  }

  const MomentumIcon =
    scoreMomentum != null && scoreMomentum > 0
      ? TrendingUp
      : scoreMomentum != null && scoreMomentum < 0
        ? TrendingDown
        : Minus;

  const momentumColor =
    scoreMomentum != null && scoreMomentum > 0
      ? 'text-emerald-500'
      : scoreMomentum != null && scoreMomentum < 0
        ? 'text-rose-500'
        : 'text-muted-foreground';

  // Delegation bar chart
  const delegationCounts = delegationTrend.map((d) => d.delegatorCount);
  const maxDelegation = Math.max(...delegationCounts, 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.smooth}
      className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5 py-5 space-y-5"
    >
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Trajectory
        </span>
      </div>

      {/* Score evolution */}
      {hasScoreData && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Score Evolution</span>
          <div className="flex items-center gap-4">
            <ScoreSparkline data={scoreHistory} />
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold font-mono tabular-nums">{currentScore}</span>
              <span className="text-xs text-muted-foreground">/100</span>
              {scoreMomentum != null && scoreMomentum !== 0 && (
                <span
                  className={`text-xs font-medium tabular-nums flex items-center gap-0.5 ${momentumColor}`}
                >
                  <MomentumIcon className="h-3 w-3" />
                  {scoreMomentum > 0 ? '+' : ''}
                  {scoreMomentum.toFixed(1)} pts/day
                </span>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            {generateScoreNarrative(scoreHistory)}
          </p>
        </div>
      )}

      {/* Governance impact */}
      {hasScoreData && (
        <p className="text-[10px] text-primary/70">
          Score improvements directly raise Cardano&rsquo;s Governance Health Index.
        </p>
      )}

      {/* Delegation momentum */}
      {hasDelegationData && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Delegation Momentum</span>
          <div className="flex items-end gap-[2px] h-8">
            {delegationTrend.map((d) => (
              <div
                key={d.epoch}
                className="flex-1 bg-primary/60 rounded-t-sm min-w-[3px]"
                style={{
                  height: `${Math.max(10, (d.delegatorCount / maxDelegation) * 100)}%`,
                }}
                title={`Epoch ${d.epoch}: ${d.delegatorCount.toLocaleString()} delegators, ${d.votingPowerAda.toLocaleString()} ADA`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>E{delegationTrend[0].epoch}</span>
            <span>
              {delegatorCount.toLocaleString()} delegators · {votingPowerFormatted} ADA
            </span>
            <span>E{delegationTrend[delegationTrend.length - 1].epoch}</span>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            {generateDelegationNarrative(delegationTrend)}
          </p>
        </div>
      )}
    </motion.div>
  );
}
