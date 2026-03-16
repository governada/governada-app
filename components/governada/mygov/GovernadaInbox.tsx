'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Vote,
  AlertCircle,
  TrendingDown,
  Clock,
  Star,
  CheckCircle,
  Bell,
  ChevronRight,
  ChevronDown,
  BarChart2,
  Activity,
  MessageSquare,
  Shield,
  Landmark,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

import { useSegment } from '@/components/providers/SegmentProvider';
import {
  useDRepReportCard,
  useGovernancePulse,
  useDashboardInbox,
  useDashboardUrgent,
  useInboxNotifications,
  type InboxNotification,
} from '@/hooks/queries';
import { generateActions } from '@/lib/actionFeed';
import { SPOInbox } from './SPOInbox';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationCategory = 'proposal' | 'score' | 'alignment' | 'communication' | 'system';
type FilterTab = 'all' | NotificationCategory;

interface NotificationItem {
  id: string;
  category: NotificationCategory;
  icon: React.FC<{ className?: string }>;
  iconColor: string;
  borderColor: string;
  bgColor: string;
  title: string;
  description: string;
  href?: string;
  cta?: string;
  priority: 1 | 2 | 3;
}

const STORAGE_KEY = 'governada_inbox_read';

function getReadSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markRead(ids: string[]) {
  try {
    const current = getReadSet();
    ids.forEach((id) => current.add(id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current]));
  } catch {
    // Storage unavailable
  }
}

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'proposal', label: 'Proposals' },
  { key: 'score', label: 'Score' },
  { key: 'alignment', label: 'Alignment' },
  { key: 'communication', label: 'Communication' },
  { key: 'system', label: 'System' },
];

// ---------------------------------------------------------------------------
// Map action types → notification metadata
// ---------------------------------------------------------------------------

function actionToNotification(
  action: ReturnType<typeof generateActions>[number],
): NotificationItem {
  const map: Record<
    string,
    Pick<NotificationItem, 'category' | 'icon' | 'iconColor' | 'borderColor' | 'bgColor'>
  > = {
    vote_required: {
      category: 'proposal',
      icon: Vote,
      iconColor: 'text-primary',
      borderColor: 'border-primary/20',
      bgColor: 'bg-primary/5',
    },
    delegation_stale: {
      category: 'alignment',
      icon: AlertCircle,
      iconColor: 'text-rose-400',
      borderColor: 'border-rose-900/30',
      bgColor: 'bg-rose-950/10',
    },
    score_dropped: {
      category: 'score',
      icon: TrendingDown,
      iconColor: 'text-amber-400',
      borderColor: 'border-amber-900/30',
      bgColor: 'bg-amber-950/10',
    },
    proposal_expiring: {
      category: 'proposal',
      icon: Clock,
      iconColor: 'text-amber-400',
      borderColor: 'border-amber-900/30',
      bgColor: 'bg-amber-950/10',
    },
    tier_approaching: {
      category: 'score',
      icon: Star,
      iconColor: 'text-violet-400',
      borderColor: 'border-violet-900/30',
      bgColor: 'bg-violet-950/10',
    },
    ncl_threshold: {
      category: 'proposal',
      icon: Landmark,
      iconColor: 'text-amber-400',
      borderColor: 'border-amber-900/30',
      bgColor: 'bg-amber-950/10',
    },
    ncl_period_expiring: {
      category: 'proposal',
      icon: Landmark,
      iconColor: 'text-amber-400',
      borderColor: 'border-amber-900/30',
      bgColor: 'bg-amber-950/10',
    },
  };

  const meta = map[action.type] ?? {
    category: 'system' as const,
    icon: Bell,
    iconColor: 'text-muted-foreground',
    borderColor: 'border-border',
    bgColor: 'bg-card',
  };

  return {
    id: action.id,
    ...meta,
    title: action.title,
    description: action.description,
    href: action.href,
    cta: action.cta,
    priority: action.priority,
  };
}

// ---------------------------------------------------------------------------
// Map DB notification → NotificationItem
// ---------------------------------------------------------------------------

const DB_TYPE_META: Record<
  string,
  Pick<NotificationItem, 'category' | 'icon' | 'iconColor' | 'borderColor' | 'bgColor'>
> = {
  'score-change': {
    category: 'score',
    icon: TrendingDown,
    iconColor: 'text-amber-400',
    borderColor: 'border-amber-900/30',
    bgColor: 'bg-amber-950/10',
  },
  'pending-proposals': {
    category: 'proposal',
    icon: Vote,
    iconColor: 'text-primary',
    borderColor: 'border-primary/20',
    bgColor: 'bg-primary/5',
  },
  'urgent-deadline': {
    category: 'proposal',
    icon: Clock,
    iconColor: 'text-rose-400',
    borderColor: 'border-rose-900/30',
    bgColor: 'bg-rose-950/10',
  },
  'delegation-change': {
    category: 'alignment',
    icon: AlertCircle,
    iconColor: 'text-amber-400',
    borderColor: 'border-amber-900/30',
    bgColor: 'bg-amber-950/10',
  },
  'tier-change': {
    category: 'score',
    icon: Star,
    iconColor: 'text-violet-400',
    borderColor: 'border-violet-900/30',
    bgColor: 'bg-violet-950/10',
  },
  'rank-change': {
    category: 'score',
    icon: BarChart2,
    iconColor: 'text-sky-400',
    borderColor: 'border-sky-900/30',
    bgColor: 'bg-sky-950/10',
  },
  'alignment-drift': {
    category: 'alignment',
    icon: AlertCircle,
    iconColor: 'text-amber-400',
    borderColor: 'border-amber-900/30',
    bgColor: 'bg-amber-950/10',
  },
  'drep-voted': {
    category: 'proposal',
    icon: Vote,
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-900/30',
    bgColor: 'bg-emerald-950/10',
  },
  'drep-missed-vote': {
    category: 'proposal',
    icon: Vote,
    iconColor: 'text-rose-400',
    borderColor: 'border-rose-900/30',
    bgColor: 'bg-rose-950/10',
  },
  'citizen-level-up': {
    category: 'score',
    icon: Star,
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-900/30',
    bgColor: 'bg-emerald-950/10',
  },
  'better-match-found': {
    category: 'alignment',
    icon: Activity,
    iconColor: 'text-primary',
    borderColor: 'border-primary/20',
    bgColor: 'bg-primary/5',
  },
};

function dbNotificationToItem(n: InboxNotification): NotificationItem {
  const meta = DB_TYPE_META[n.type] ?? {
    category: 'system' as const,
    icon: Bell,
    iconColor: 'text-muted-foreground',
    borderColor: 'border-border',
    bgColor: 'bg-card',
  };

  return {
    id: `db_${n.id}`,
    ...meta,
    title: n.title,
    description: n.body ?? '',
    href: n.action_url ?? undefined,
    cta: n.action_url ? 'View' : undefined,
    priority: 2,
  };
}

async function markNotificationsRead(ids: string[]): Promise<void> {
  const { getStoredSession } = await import('@/lib/supabaseAuth');
  const token = getStoredSession();
  if (!token) return;
  const dbIds = ids.filter((id) => id.startsWith('db_')).map((id) => id.slice(3));
  const localIds = ids.filter((id) => !id.startsWith('db_'));
  if (localIds.length > 0) markRead(localIds);
  if (dbIds.length === 0) return;
  await fetch('/api/you/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ids: dbIds }),
  });
}

async function markAllNotificationsRead(): Promise<void> {
  const { getStoredSession } = await import('@/lib/supabaseAuth');
  const token = getStoredSession();
  if (!token) return;
  await fetch('/api/you/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ markAllRead: true }),
  });
}

// ---------------------------------------------------------------------------
// Notification card
// ---------------------------------------------------------------------------

function NotificationCard({
  item,
  isRead,
  onRead,
}: {
  item: NotificationItem;
  isRead: boolean;
  onRead: (id: string) => void;
}) {
  const Icon = item.icon;

  const cardContent = (
    <>
      {!isRead && (
        <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary shrink-0" />
      )}
      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', item.iconColor)} />
      <div className="flex-1 min-w-0 pr-4">
        <p className={cn('text-sm font-medium leading-snug', !isRead && 'text-foreground')}>
          {item.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
      </div>
      {item.href && item.cta && (
        <div className="flex items-center gap-0.5 shrink-0 text-xs font-medium text-muted-foreground">
          {item.cta}
          <ChevronRight className="h-3 w-3" />
        </div>
      )}
    </>
  );

  const cardClasses = cn(
    'relative flex items-start gap-3 rounded-xl border p-4 transition-all',
    item.borderColor,
    item.bgColor,
    !isRead && 'shadow-sm',
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        className={cn(cardClasses, 'hover:brightness-110 cursor-pointer block')}
        onClick={() => onRead(item.id)}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <div
      className={cardClasses}
      onClick={() => onRead(item.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onRead(item.id);
      }}
      role="button"
      tabIndex={0}
    >
      {cardContent}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quiet-mode summary — shown when only informational (priority 3) items exist
// ---------------------------------------------------------------------------

function QuietModeSummary({
  ghiScore,
  ghiDelta,
  activeProposals,
  infoCount,
  showDetails,
  onToggleDetails,
}: {
  ghiScore?: number;
  ghiDelta?: number;
  activeProposals?: number;
  infoCount: number;
  showDetails: boolean;
  onToggleDetails: () => void;
}) {
  const ghiLabel =
    ghiScore != null
      ? ghiScore >= 70
        ? 'healthy'
        : ghiScore >= 45
          ? 'moderate'
          : 'needs attention'
      : null;
  const ghiColor =
    ghiLabel === 'healthy'
      ? 'text-emerald-400'
      : ghiLabel === 'moderate'
        ? 'text-amber-400'
        : ghiLabel === 'needs attention'
          ? 'text-rose-400'
          : 'text-muted-foreground';

  return (
    <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 px-5 py-6 space-y-3">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-emerald-400 shrink-0" />
        <div>
          <p className="text-sm font-medium text-emerald-300">Governance is running smoothly</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            No urgent items require your attention this epoch.
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        {ghiScore != null && (
          <span>
            Health:{' '}
            <strong className={ghiColor}>
              {ghiScore.toFixed(0)}
              {ghiDelta != null && ghiDelta !== 0 && (
                <span className="ml-0.5">
                  ({ghiDelta > 0 ? '+' : ''}
                  {ghiDelta.toFixed(1)})
                </span>
              )}
            </strong>
          </span>
        )}
        {activeProposals != null && activeProposals > 0 && (
          <span>
            Active proposals: <strong className="text-foreground">{activeProposals}</strong>
          </span>
        )}
      </div>

      {/* Toggle for informational items */}
      {infoCount > 0 && (
        <button
          onClick={onToggleDetails}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown
            className={cn('h-3 w-3 transition-transform', showDetails && 'rotate-180')}
          />
          {showDetails ? 'Hide' : 'View'} {infoCount} informational update{infoCount > 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Supplemental system notifications (epoch health, governance activity)
// ---------------------------------------------------------------------------

function buildSystemNotifications(pulse: Record<string, unknown> | undefined): NotificationItem[] {
  const items: NotificationItem[] = [];
  if (!pulse) return items;

  const activeProposals = pulse.activeProposals as number | undefined;
  const ghiScore = pulse.ghiScore as number | undefined;
  const ghiDelta = pulse.ghiDelta as number | undefined;

  if (activeProposals != null && activeProposals > 0) {
    items.push({
      id: 'sys_active_proposals',
      category: 'system',
      icon: Activity,
      iconColor: 'text-sky-400',
      borderColor: 'border-sky-900/30',
      bgColor: 'bg-sky-950/10',
      title: `${activeProposals} governance proposal${activeProposals > 1 ? 's' : ''} in progress`,
      description: 'Cardano governance is active. Your delegation is participating.',
      href: '/governance/proposals',
      cta: 'View',
      priority: 3,
    });
  }

  if (ghiScore != null) {
    const ghiDir = (ghiDelta ?? 0) > 0 ? 'up' : (ghiDelta ?? 0) < 0 ? 'down' : 'stable';
    items.push({
      id: 'sys_ghi',
      category: 'system',
      icon: BarChart2,
      iconColor:
        ghiDir === 'up'
          ? 'text-emerald-400'
          : ghiDir === 'down'
            ? 'text-rose-400'
            : 'text-muted-foreground',
      borderColor: 'border-border',
      bgColor: 'bg-card',
      title: `Governance health: ${ghiScore.toFixed(0)}${ghiDelta != null ? ` (${ghiDelta > 0 ? '+' : ''}${ghiDelta.toFixed(1)} this epoch)` : ''}`,
      description: 'The Governance Health Index reflects current ecosystem health.',
      href: '/governance/health',
      cta: 'See Pulse',
      priority: 3,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GovernadaInbox() {
  const { segment, drepId, delegatedDrep, poolId } = useSegment();

  // Render SPO-specific inbox when in SPO segment
  if (segment === 'spo' && poolId) {
    return <SPOInbox />;
  }

  return <GovernadaInboxInner segment={segment} drepId={drepId} delegatedDrep={delegatedDrep} />;
}

function GovernadaInboxInner({
  segment,
  drepId,
  delegatedDrep,
}: {
  segment: string;
  drepId: string | null;
  delegatedDrep: string | null;
}) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  const [showInfoItems, setShowInfoItems] = useState(false);

  const isAuthenticated = segment !== 'anonymous';
  const { data: rawCard } = useDRepReportCard(segment === 'drep' ? drepId : delegatedDrep);
  const { data: rawPulse, isLoading: pulseLoading } = useGovernancePulse();
  const { data: rawInbox, isLoading: inboxLoading } = useDashboardInbox(
    segment === 'drep' ? drepId : null,
  );
  const { data: rawUrgent } = useDashboardUrgent(segment === 'drep' ? drepId : null);
  const { data: dbNotifications, isLoading: dbLoading } = useInboxNotifications(isAuthenticated);

  const card = rawCard as
    | {
        score?: number;
        momentum?: number;
        isActive?: boolean;
        tier?: string;
        totalVotes?: number;
        claimed?: boolean;
      }
    | undefined;
  const pulse = rawPulse as
    | { activeProposals?: number; criticalProposals?: number; ghiScore?: number; ghiDelta?: number }
    | undefined;
  const inbox = rawInbox as
    | {
        pendingCount?: number;
        scoreImpact?: { potentialGain?: number };
        pendingProposals?: {
          txHash?: string;
          id?: string;
          index?: number;
          title?: string;
          proposalTitle?: string;
          priority?: string;
          epochsRemaining?: number;
          perProposalScoreImpact?: number;
        }[];
      }
    | undefined;

  // Build read set from localStorage + DB read state
  useEffect(() => {
    const localRead = getReadSet();
    if (dbNotifications?.notifications) {
      for (const n of dbNotifications.notifications) {
        if (n.read) localRead.add(`db_${n.id}`);
      }
    }
    setReadSet(localRead);
  }, [dbNotifications]);

  const handleRead = useCallback((id: string) => {
    setReadSet((prev) => new Set([...prev, id]));
    markNotificationsRead([id]);
  }, []);

  const handleMarkAllRead = useCallback((items: NotificationItem[]) => {
    const ids = items.map((i) => i.id);
    setReadSet((prev) => new Set([...prev, ...ids]));
    markNotificationsRead(ids);
    markAllNotificationsRead();
  }, []);

  // Build notifications from action feed + system events
  const actions = generateActions({
    segment,
    activeProposals: pulse?.activeProposals ?? 0,
    criticalProposals: pulse?.criticalProposals ?? 0,
    drepScore: card?.score ?? undefined,
    scoreDelta: card?.momentum ?? undefined,
    drepIsActive: card?.isActive ?? undefined,
    delegatedDrep,
    delegatedDrepScore: segment !== 'drep' ? (card?.score ?? undefined) : undefined,
    delegatedDrepIsActive: segment !== 'drep' ? (card?.isActive ?? undefined) : undefined,
    pendingVotesCount: segment === 'drep' ? (inbox?.pendingCount ?? 0) : 0,
    drepTier: card?.tier ?? undefined,
    spoScore: segment === 'spo' ? (card?.score ?? undefined) : undefined,
    spoScoreDelta: segment === 'spo' ? (card?.momentum ?? undefined) : undefined,
    spoVoteCount: segment === 'spo' ? (card?.totalVotes ?? 0) : undefined,
    spoIsClaimed: segment === 'spo' ? (card?.claimed ?? true) : undefined,
  });

  const systemNotes = buildSystemNotifications(pulse);
  const urgent = rawUrgent as { unansweredQuestions?: number } | undefined;
  const communicationNotes: NotificationItem[] = [];
  if (segment === 'drep' && (urgent?.unansweredQuestions ?? 0) > 0) {
    const count = urgent!.unansweredQuestions!;
    communicationNotes.push({
      id: `comm_unanswered_${count}`,
      category: 'communication',
      icon: MessageSquare,
      iconColor: 'text-primary',
      borderColor: 'border-primary/20',
      bgColor: 'bg-primary/5',
      title: `${count} unanswered question${count > 1 ? 's' : ''} from delegators`,
      description: 'Responding to questions builds trust and improves engagement.',
      href: '/my-gov',
      cta: 'Respond',
      priority: 2,
    });
  }

  // DB-persisted notifications (from Inngest check-notifications pipeline)
  const dbItems: NotificationItem[] = (dbNotifications?.notifications ?? [])
    .filter((n) => !n.read)
    .map(dbNotificationToItem);

  const allNotifications: NotificationItem[] = [
    ...actions.map(actionToNotification),
    ...dbItems,
    ...communicationNotes,
    ...systemNotes,
  ];

  // Filter
  const filtered =
    activeFilter === 'all'
      ? allNotifications
      : allNotifications.filter((n) => n.category === activeFilter);

  const unreadCount = allNotifications.filter((n) => !readSet.has(n.id)).length;
  const isLoading = pulseLoading || inboxLoading || (isAuthenticated && dbLoading);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Inbox</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={() => handleMarkAllRead(filtered)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <CheckCircle className="h-3 w-3" />
              Mark all read
            </button>
          )}
          <Link
            href="/you/settings"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Manage
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {FILTER_TABS.filter((t) => {
            // Hide system tab for anon
            if (t.key === 'system' && segment === 'anonymous') return false;
            return true;
          }).map((tab) => {
            const count =
              tab.key === 'all'
                ? allNotifications.filter((n) => !readSet.has(n.id)).length
                : allNotifications.filter((n) => n.category === tab.key && !readSet.has(n.id))
                    .length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={cn(
                  'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  activeFilter === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center h-4 min-w-4 rounded-full text-[10px] font-bold px-1',
                      activeFilter === tab.key
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-primary/20 text-primary',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content — smart quiet mode */}
        {(() => {
          if (isLoading) {
            return (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            );
          }

          if (filtered.length === 0) {
            return (
              <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 px-5 py-10 text-center space-y-2">
                <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-medium text-emerald-300">You&apos;re all caught up</p>
                <p className="text-xs text-muted-foreground">
                  {activeFilter === 'all'
                    ? 'No governance notifications right now. Your participation is healthy.'
                    : `No ${activeFilter} notifications right now.`}
                </p>
              </div>
            );
          }

          // Split into urgent (priority 1-2) and informational (priority 3)
          const urgentItems = filtered.filter((n) => n.priority <= 2);
          const infoItems = filtered.filter((n) => n.priority > 2);

          // Quiet mode: no urgent items, only informational
          if (urgentItems.length === 0 && infoItems.length > 0 && activeFilter === 'all') {
            return (
              <div className="space-y-2">
                <QuietModeSummary
                  ghiScore={pulse?.ghiScore ?? undefined}
                  ghiDelta={pulse?.ghiDelta ?? undefined}
                  activeProposals={pulse?.activeProposals ?? undefined}
                  infoCount={infoItems.length}
                  showDetails={showInfoItems}
                  onToggleDetails={() => setShowInfoItems((v) => !v)}
                />
                {showInfoItems && (
                  <div className="space-y-2">
                    {infoItems.map((item) => (
                      <NotificationCard
                        key={item.id}
                        item={item}
                        isRead={readSet.has(item.id)}
                        onRead={handleRead}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          }

          // Normal mode: show urgent items first, then info items
          return (
            <div className="space-y-2">
              {urgentItems.map((item) => (
                <NotificationCard
                  key={item.id}
                  item={item}
                  isRead={readSet.has(item.id)}
                  onRead={handleRead}
                />
              ))}
              {infoItems.length > 0 && urgentItems.length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowInfoItems((v) => !v)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
                  >
                    <ChevronDown
                      className={cn('h-3 w-3 transition-transform', showInfoItems && 'rotate-180')}
                    />
                    {showInfoItems ? 'Hide' : 'Show'} {infoItems.length} informational update
                    {infoItems.length > 1 ? 's' : ''}
                  </button>
                  {showInfoItems &&
                    infoItems.map((item) => (
                      <NotificationCard
                        key={item.id}
                        item={item}
                        isRead={readSet.has(item.id)}
                        onRead={handleRead}
                      />
                    ))}
                </div>
              )}
              {infoItems.length > 0 &&
                urgentItems.length === 0 &&
                infoItems.map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    isRead={readSet.has(item.id)}
                    onRead={handleRead}
                  />
                ))}
            </div>
          );
        })()}

        {/* DRep pending proposals detail (DRep segment only) */}
        {segment === 'drep' && inbox?.pendingProposals && inbox.pendingProposals.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pending Votes ({inbox.pendingCount ?? 0})
              </p>
              {(inbox.scoreImpact?.potentialGain ?? 0) > 0 && (
                <span className="text-xs text-emerald-400 font-medium">
                  +{inbox.scoreImpact!.potentialGain!.toFixed(1)} pts potential
                </span>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {inbox.pendingProposals.slice(0, 5).map((p) => (
                <Link
                  key={p.txHash ?? p.id ?? ''}
                  href={`/proposal/${p.txHash}/${p.index ?? 0}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate font-medium">
                      {p.title ?? p.proposalTitle ?? 'Proposal'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.priority === 'critical' && (
                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                          Critical
                        </span>
                      )}
                      {p.epochsRemaining != null && (
                        <span className="text-[10px] text-muted-foreground">
                          {p.epochsRemaining} epoch{p.epochsRemaining !== 1 ? 's' : ''} left
                        </span>
                      )}
                      {(p.perProposalScoreImpact ?? 0) > 0 && (
                        <span className="text-[10px] text-emerald-400">
                          +{p.perProposalScoreImpact} pts
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </Link>
              ))}
            </div>
            {inbox.pendingProposals.length > 5 && (
              <Link
                href="/governance/proposals"
                className="block text-center text-xs text-muted-foreground hover:text-primary transition-colors py-1"
              >
                View all {inbox.pendingCount ?? 0} pending proposals
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
