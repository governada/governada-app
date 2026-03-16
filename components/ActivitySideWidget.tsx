'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Vote, FileText, Users, ScrollText, TrendingUp, CheckCircle2 } from 'lucide-react';
import { posthog } from '@/lib/posthog';

interface ActivityEvent {
  type: 'vote' | 'rationale' | 'proposal' | 'delegation' | 'score_change' | 'proposal_outcome';
  drepId: string;
  drepName: string | null;
  detail: string | null;
  vote?: 'Yes' | 'No' | 'Abstain';
  timestamp: number;
  proposalTxHash?: string;
  proposalIndex?: number;
}

const EVENT_CONFIG: Record<string, { icon: typeof Vote; color: string; bg: string }> = {
  vote: { icon: Vote, color: 'text-green-400', bg: 'bg-green-500/10' },
  rationale: { icon: ScrollText, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  proposal: { icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  delegation: { icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  score_change: { icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  proposal_outcome: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
};

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatEventText(event: ActivityEvent): string {
  const name = event.drepName || (event.drepId ? `${event.drepId.slice(0, 8)}…` : '');

  switch (event.type) {
    case 'vote': {
      const proposal = event.detail ? ` on ${event.detail}` : '';
      return `${name} voted ${event.vote}${proposal}`;
    }
    case 'rationale':
      return `${name} published rationale`;
    case 'proposal':
      return event.detail ? `New: ${event.detail}` : 'New proposal submitted';
    case 'score_change':
      return event.detail || `${name} score changed`;
    case 'proposal_outcome':
      return event.detail || 'Proposal outcome recorded';
    default:
      return '';
  }
}

interface ActivitySideWidgetProps {
  drepId?: string;
  limit?: number;
  className?: string;
}

export function ActivitySideWidget({ drepId, limit = 5, className = '' }: ActivitySideWidgetProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  const fetchEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (drepId) params.set('drepId', drepId);
      const res = await fetch(`/api/governance/activity?${params}`);
      if (!res.ok) return;
      const data: ActivityEvent[] = await res.json();
      setEvents(data);
    } catch {}
  }, [limit, drepId]);

  useEffect(() => {
    fetchEvents();
    posthog.capture('activity_side_widget_viewed', { drep_id: drepId ?? null });
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchEvents();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchEvents, drepId]);

  if (events.length === 0) return null;

  return (
    <div
      className={`rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm p-4 ${className}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </div>
        <h3 className="text-sm font-medium text-muted-foreground">
          {drepId ? 'Recent Activity' : 'Live Governance'}
        </h3>
      </div>
      <ul className="space-y-2.5" aria-label="Recent governance activity">
        {events.map((event, i) => {
          const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.vote;
          const Icon = config.icon;
          return (
            <li key={`${event.timestamp}-${i}`} className="flex items-start gap-2.5">
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full ${config.bg} shrink-0 mt-0.5`}
              >
                <Icon className={`h-3 w-3 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                {event.proposalTxHash != null ? (
                  <Link
                    href={`/proposal/${event.proposalTxHash}/${event.proposalIndex ?? 0}`}
                    className="text-xs leading-snug line-clamp-2 hover:text-primary transition-colors"
                  >
                    {formatEventText(event)}
                  </Link>
                ) : (
                  <p className="text-xs leading-snug line-clamp-2">{formatEventText(event)}</p>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(event.timestamp)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
