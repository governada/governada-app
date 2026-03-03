'use client';

import { useEffect, useState, useCallback } from 'react';
import { Vote, FileText, Users, ScrollText, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';

interface ActivityEvent {
  type: 'vote' | 'rationale' | 'proposal' | 'score_change' | 'proposal_outcome';
  drepId: string;
  drepName: string | null;
  detail: string | null;
  vote?: 'Yes' | 'No' | 'Abstain';
  timestamp: number;
}

const EVENT_ICONS: Record<string, { icon: typeof Vote; color: string; bg: string }> = {
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
  const name = event.drepName || (event.drepId ? `${event.drepId.slice(0, 8)}...` : '');

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

export function ActivityFeed({ limit = 10 }: { limit?: number }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/governance/activity?limit=${limit}`);
      if (!res.ok) return;
      const data: ActivityEvent[] = await res.json();
      setEvents(data);
    } catch {}
  }, [limit]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchEvents();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  if (events.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          Live Governance Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3" aria-label="Recent governance activity">
          {events.map((event, i) => {
            const config = EVENT_ICONS[event.type] || EVENT_ICONS.vote;
            const Icon = config.icon;
            return (
              <li key={`${event.timestamp}-${i}`} className="flex items-start gap-3">
                <div
                  className={`flex items-center justify-center w-7 h-7 rounded-full ${config.bg} shrink-0 mt-0.5`}
                >
                  <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{formatEventText(event)}</p>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
