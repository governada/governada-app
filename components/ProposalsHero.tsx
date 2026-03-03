'use client';

import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';
import { spring } from '@/lib/animations';
import { NarrativeSummary } from './NarrativeSummary';
import { AlertTriangle, Clock, Landmark } from 'lucide-react';

interface ProposalsHeroProps {
  openCount: number;
  expiringCount: number;
  totalAdaAtStake: number;
  narrativeText: string | null;
}

function AnimatedCounter({ value, className }: { value: number; className?: string }) {
  const springVal = useSpring(0, { stiffness: 100, damping: 20 });
  const display = useTransform(springVal, (v) => Math.round(v));

  useEffect(() => {
    springVal.set(value);
  }, [value, springVal]);

  return <motion.span className={className}>{display}</motion.span>;
}

export function ProposalsHero({
  openCount,
  expiringCount,
  totalAdaAtStake,
  narrativeText,
}: ProposalsHeroProps) {
  const hasUrgent = expiringCount > 0;
  const adaFormatted =
    totalAdaAtStake >= 1_000_000
      ? `${(totalAdaAtStake / 1_000_000).toFixed(1)}M`
      : totalAdaAtStake >= 1_000
        ? `${(totalAdaAtStake / 1_000).toFixed(0)}K`
        : totalAdaAtStake.toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.smooth}
      className={`rounded-lg border p-5 mb-6 ${
        hasUrgent
          ? 'border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-transparent'
          : 'border-border bg-card/50'
      }`}
    >
      <div className="flex flex-wrap items-center gap-6 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
            <Landmark className="h-4 w-4 text-primary" />
          </div>
          <div>
            <AnimatedCounter value={openCount} className="text-2xl font-bold tabular-nums" />
            <p className="text-xs text-muted-foreground">Open</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full ${
              hasUrgent ? 'bg-amber-500/10' : 'bg-muted/50'
            }`}
          >
            <Clock
              className={`h-4 w-4 ${hasUrgent ? 'text-amber-500' : 'text-muted-foreground'}`}
            />
          </div>
          <div>
            <AnimatedCounter
              value={expiringCount}
              className={`text-2xl font-bold tabular-nums ${hasUrgent ? 'text-amber-500' : ''}`}
            />
            <p className="text-xs text-muted-foreground">Expiring Soon</p>
          </div>
        </div>

        {totalAdaAtStake > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10">
              <Landmark className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <span className="text-2xl font-bold tabular-nums">{adaFormatted}</span>
              <p className="text-xs text-muted-foreground">ADA at Stake</p>
            </div>
          </div>
        )}
      </div>

      <NarrativeSummary text={narrativeText} />
    </motion.div>
  );
}
