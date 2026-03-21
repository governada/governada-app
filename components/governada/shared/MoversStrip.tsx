'use client';

import { cn } from '@/lib/utils';
import { TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface Mover {
  id: string;
  name: string;
  score: number;
  scoreDelta: number;
  reason?: string;
}

interface MoversStripProps {
  movers: Mover[];
  entityType?: 'drep' | 'spo';
  className?: string;
}

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.3, ease: 'easeOut' as const },
  }),
};

export function MoversStrip({ movers, entityType = 'drep', className }: MoversStripProps) {
  if (movers.length === 0) return null;

  const browseHref = entityType === 'drep' ? '/representatives' : '/stake-pools';
  const entityLabel = entityType === 'drep' ? 'representatives' : 'pools';

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <TrendingUp className="h-4 w-4 text-emerald-500" aria-hidden="true" />
        <span>Who&apos;s rising this epoch?</span>
      </div>

      {/* Movers list */}
      <div className="space-y-1.5">
        {movers.slice(0, 3).map((mover, i) => (
          <motion.div
            key={mover.id}
            className="flex items-start gap-2"
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            custom={i}
          >
            {/* Rank circle */}
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              {i + 1}
            </span>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="truncate text-sm font-semibold">{mover.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {mover.score}
                </span>
                <span
                  className={cn(
                    'shrink-0 text-xs font-medium tabular-nums',
                    mover.scoreDelta >= 0 ? 'text-emerald-500' : 'text-red-500',
                  )}
                >
                  ({mover.scoreDelta >= 0 ? '+' : ''}
                  {mover.scoreDelta})
                </span>
              </div>
              {mover.reason && (
                <p className="truncate text-xs text-muted-foreground">{mover.reason}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Browse link */}
      <Link
        href={browseHref}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        See all {entityLabel} &rarr;
      </Link>
    </div>
  );
}
