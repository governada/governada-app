'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import {
  Vote,
  TrendingDown,
  TrendingUp,
  Clock,
  Star,
  Bell,
  CheckCircle,
  ChevronRight,
  AlertCircle,
  Activity,
  BarChart2,
  Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  type Notification,
} from '@/hooks/useNotifications';

// ── Type to icon/color mapping ──────────────────────────────────────────────

const TYPE_META: Record<
  string,
  { icon: typeof Bell; iconColor: string; borderColor: string; bgColor: string }
> = {
  'score-change': {
    icon: TrendingDown,
    iconColor: 'text-amber-400',
    borderColor: 'border-amber-900/30',
    bgColor: 'bg-amber-950/10',
  },
  'drep-voted': {
    icon: Vote,
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-900/30',
    bgColor: 'bg-emerald-950/10',
  },
  'drep-score-change': {
    icon: TrendingDown,
    iconColor: 'text-amber-400',
    borderColor: 'border-amber-900/30',
    bgColor: 'bg-amber-950/10',
  },
  'drep-missed-vote': {
    icon: Vote,
    iconColor: 'text-rose-400',
    borderColor: 'border-rose-900/30',
    bgColor: 'bg-rose-950/10',
  },
  'drep-inactive': {
    icon: AlertCircle,
    iconColor: 'text-rose-400',
    borderColor: 'border-rose-900/30',
    bgColor: 'bg-rose-950/10',
  },
  'tier-change': {
    icon: Star,
    iconColor: 'text-violet-400',
    borderColor: 'border-violet-900/30',
    bgColor: 'bg-violet-950/10',
  },
  'citizen-level-up': {
    icon: Award,
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-900/30',
    bgColor: 'bg-emerald-950/10',
  },
  'engagement-outcome': {
    icon: CheckCircle,
    iconColor: 'text-primary',
    borderColor: 'border-primary/20',
    bgColor: 'bg-primary/5',
  },
  'pending-proposals': {
    icon: Vote,
    iconColor: 'text-primary',
    borderColor: 'border-primary/20',
    bgColor: 'bg-primary/5',
  },
  'urgent-deadline': {
    icon: Clock,
    iconColor: 'text-rose-400',
    borderColor: 'border-rose-900/30',
    bgColor: 'bg-rose-950/10',
  },
  'alignment-drift': {
    icon: AlertCircle,
    iconColor: 'text-amber-400',
    borderColor: 'border-amber-900/30',
    bgColor: 'bg-amber-950/10',
  },
  'governance-brief': {
    icon: BarChart2,
    iconColor: 'text-sky-400',
    borderColor: 'border-sky-900/30',
    bgColor: 'bg-sky-950/10',
  },
  'delegation-change': {
    icon: Activity,
    iconColor: 'text-amber-400',
    borderColor: 'border-amber-900/30',
    bgColor: 'bg-amber-950/10',
  },
  'score-opportunity': {
    icon: TrendingUp,
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-900/30',
    bgColor: 'bg-emerald-950/10',
  },
};

const DEFAULT_META = {
  icon: Bell,
  iconColor: 'text-muted-foreground',
  borderColor: 'border-border',
  bgColor: 'bg-card',
};

// ── Time formatting ─────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dateGroupLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) return 'Today';
  if (daysDiff === 1) return 'Yesterday';
  if (daysDiff < 7) return 'This week';
  if (daysDiff < 30) return 'This month';
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function groupNotificationsByDate(
  notifications: Notification[] | undefined,
): Array<{ label: string; notifications: Notification[] }> {
  if (!notifications) return [];

  const groups: Array<{ label: string; notifications: Notification[] }> = [];
  let currentLabel = '';
  let currentNotifications: Notification[] = [];

  for (const n of notifications) {
    const label = dateGroupLabel(n.created_at);
    if (label !== currentLabel) {
      if (currentNotifications.length > 0) {
        groups.push({ label: currentLabel, notifications: currentNotifications });
      }
      currentLabel = label;
      currentNotifications = [n];
    } else {
      currentNotifications.push(n);
    }
  }

  if (currentNotifications.length > 0) {
    groups.push({ label: currentLabel, notifications: currentNotifications });
  }

  return groups;
}

// ── Notification card ───────────────────────────────────────────────────────

function NotificationCard({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  const meta = TYPE_META[notification.type] ?? DEFAULT_META;
  const Icon = meta.icon;

  const cardContent = (
    <>
      {!notification.read && (
        <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary shrink-0" />
      )}
      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', meta.iconColor)} />
      <div className="flex-1 min-w-0 pr-4">
        <p
          className={cn(
            'text-sm font-medium leading-snug',
            !notification.read && 'text-foreground',
          )}
        >
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
        )}
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          {timeAgo(notification.created_at)}
        </p>
      </div>
      {notification.action_url && (
        <div className="flex items-center gap-0.5 shrink-0 text-xs font-medium text-muted-foreground">
          View
          <ChevronRight className="h-3 w-3" />
        </div>
      )}
    </>
  );

  const cardClasses = cn(
    'relative flex items-start gap-3 rounded-xl border p-4 transition-all',
    meta.borderColor,
    meta.bgColor,
    !notification.read && 'shadow-sm',
  );

  const handleClick = () => {
    if (!notification.read) onMarkRead(notification.id);
  };

  if (notification.action_url) {
    return (
      <Link
        href={notification.action_url}
        className={cn(cardClasses, 'hover:brightness-110 cursor-pointer block')}
        onClick={handleClick}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <div
      className={cardClasses}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
      role="button"
      tabIndex={0}
    >
      {cardContent}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

interface InboxFeedProps {
  isAuthenticated: boolean;
}

export function InboxFeed({ isAuthenticated }: InboxFeedProps) {
  const { data, isLoading } = useNotifications(isAuthenticated);
  const markReadMutation = useMarkRead();
  const markAllReadMutation = useMarkAllRead();

  const handleMarkRead = useCallback(
    (id: string) => {
      markReadMutation.mutate([id]);
    },
    [markReadMutation],
  );

  const handleMarkAllRead = useCallback(() => {
    markAllReadMutation.mutate();
  }, [markAllReadMutation]);

  // Group notifications by date
  const notifications = data?.notifications;
  const grouped = groupNotificationsByDate(notifications);

  const unreadCount = data?.unreadCount ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data?.notifications?.length) {
    return (
      <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 px-5 py-10 text-center space-y-2">
        <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto" />
        <p className="text-sm font-medium text-emerald-300">You&apos;re all caught up</p>
        <p className="text-xs text-muted-foreground">
          No governance notifications right now. Your participation is healthy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <CheckCircle className="h-3 w-3" />
            Mark all read
          </button>
        )}
      </div>

      {/* Grouped notifications */}
      {grouped.map((group) => (
        <div key={group.label}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {group.label}
          </p>
          <div className="space-y-2">
            {group.notifications.map((n) => (
              <NotificationCard key={n.id} notification={n} onMarkRead={handleMarkRead} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
