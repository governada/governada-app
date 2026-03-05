'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Vote, AlertCircle, TrendingDown, Clock, Star, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Action, ActionType } from '@/lib/actionFeed';

const TYPE_ICON: Record<ActionType, React.FC<{ className?: string }>> = {
  vote_required: Vote,
  delegation_stale: AlertCircle,
  score_dropped: TrendingDown,
  proposal_expiring: Clock,
  tier_approaching: Star,
};

const TYPE_COLOR: Record<ActionType, string> = {
  vote_required: 'text-primary border-primary/30 bg-primary/5',
  delegation_stale: 'text-rose-400 border-rose-900/40 bg-rose-950/10',
  score_dropped: 'text-amber-400 border-amber-900/40 bg-amber-950/10',
  proposal_expiring: 'text-amber-400 border-amber-900/40 bg-amber-950/10',
  tier_approaching: 'text-violet-400 border-violet-900/40 bg-violet-950/10',
};

const TYPE_ICON_COLOR: Record<ActionType, string> = {
  vote_required: 'text-primary',
  delegation_stale: 'text-rose-400',
  score_dropped: 'text-amber-400',
  proposal_expiring: 'text-amber-400',
  tier_approaching: 'text-violet-400',
};

function ActionCard({ action, featured = false }: { action: Action; featured?: boolean }) {
  const Icon = TYPE_ICON[action.type];
  const colorClass = TYPE_COLOR[action.type];
  const iconColor = TYPE_ICON_COLOR[action.type];

  const inner = (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border transition-colors min-h-[44px]',
        featured ? 'p-5' : 'p-4',
        colorClass,
        action.href && 'cursor-pointer hover:brightness-110',
      )}
    >
      <Icon className={cn(featured ? 'h-5 w-5 mt-0.5' : 'h-4 w-4 mt-0.5', 'shrink-0', iconColor)} />
      <div className="flex-1 min-w-0">
        <p className={cn('font-medium leading-snug', featured ? 'text-base' : 'text-sm')}>
          {action.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
      </div>
      {action.href && action.cta && (
        <div className="flex items-center gap-0.5 shrink-0 text-xs font-medium text-muted-foreground group-hover:text-foreground">
          {action.cta}
          <ChevronRight className="h-3 w-3" />
        </div>
      )}
    </div>
  );

  const card = (
    <motion.div
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      {inner}
    </motion.div>
  );

  return action.href ? (
    <Link href={action.href} className="block group">
      {card}
    </Link>
  ) : (
    card
  );
}

export function ActionFeed({
  actions,
  emphasizeFirst = false,
}: {
  actions: Action[];
  emphasizeFirst?: boolean;
}) {
  if (actions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-8 text-center space-y-2">
        <p className="text-sm font-medium text-foreground">All caught up</p>
        <p className="text-xs text-muted-foreground">No actions required right now.</p>
      </div>
    );
  }

  if (emphasizeFirst && actions.length > 0) {
    const [first, ...rest] = actions;
    return (
      <div className="space-y-2">
        <ActionCard key={first.id} action={first} featured />
        {rest.map((action) => (
          <ActionCard key={action.id} action={action} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {actions.map((action) => (
        <ActionCard key={action.id} action={action} />
      ))}
    </div>
  );
}
