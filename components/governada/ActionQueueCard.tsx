'use client';

import Link from 'next/link';
import {
  CheckCircle2,
  Vote,
  Users,
  TrendingDown,
  Compass,
  Globe,
  User,
  Clock,
  Shield,
} from 'lucide-react';
import { useActionQueue } from '@/hooks/useActionQueue';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { ActionItem } from '@/lib/actionQueue';
import { cn } from '@/lib/utils';

const ICON_MAP = {
  vote: Vote,
  users: Users,
  trending: TrendingDown,
  compass: Compass,
  globe: Globe,
  user: User,
  clock: Clock,
  shield: Shield,
} as const;

const PRIORITY_COLORS = {
  urgent: 'bg-red-500',
  high: 'bg-amber-500',
  medium: 'bg-blue-500',
  low: 'bg-muted-foreground/30',
} as const;

function ActionItemRow({ item }: { item: ActionItem }) {
  const Icon = ICON_MAP[item.icon] ?? Globe;

  return (
    <Link
      href={item.href}
      className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50"
    >
      <div className="relative mt-0.5 shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full',
            PRIORITY_COLORS[item.priority],
            item.priority === 'urgent' && 'animate-pulse',
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug truncate">{item.title}</p>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>
        )}
        {item.deadline && (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 mt-0.5">
            <Clock className="h-3 w-3" />
            {item.deadline}
          </span>
        )}
      </div>
    </Link>
  );
}

/**
 * Action Queue card — renders on the Home page as the top card.
 * Shows 3-5 urgency items or "All caught up" empty state.
 */
export function ActionQueueCard() {
  const { segment } = useSegment();
  const { t } = useTranslation();
  const { data, isLoading } = useActionQueue();

  if (segment === 'anonymous') return null;

  const items = data?.items ?? [];

  if (isLoading && items.length === 0) return null;

  // Empty state — all caught up
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 backdrop-blur-md px-5 py-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <p className="text-sm font-medium">{t('All caught up')}</p>
            <p className="text-xs text-muted-foreground">
              {t('No actions need your attention right now')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const visibleItems = items.slice(0, 5);
  const urgentCount = items.filter((i) => i.priority === 'urgent').length;

  return (
    <div
      className={cn(
        'rounded-xl border bg-card/70 backdrop-blur-md mb-6 overflow-hidden',
        urgentCount > 0 ? 'border-red-500/30' : 'border-border/50',
      )}
    >
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          {t('Needs attention')}
        </h2>
        {urgentCount > 0 && (
          <span className="text-[10px] font-medium text-red-500">
            {urgentCount} {t('urgent')}
          </span>
        )}
      </div>
      <div className="divide-y divide-border/30">
        {visibleItems.map((item) => (
          <ActionItemRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
