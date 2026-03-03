'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Vote, FileText, Users, ScrollText } from 'lucide-react';

interface ActivityEvent {
  type: 'vote' | 'rationale' | 'proposal';
  drepId: string;
  drepName: string | null;
  detail: string | null;
  vote?: 'Yes' | 'No' | 'Abstain';
  timestamp: number;
}

interface ActivityTickerProps {
  initialEvents?: ActivityEvent[];
  onEventVisible?: (drepId: string) => void;
}

const EVENT_ICONS: Record<string, { icon: typeof Vote; color: string }> = {
  vote: { icon: Vote, color: 'text-green-400' },
  rationale: { icon: ScrollText, color: 'text-blue-400' },
  proposal: { icon: FileText, color: 'text-amber-400' },
  delegation: { icon: Users, color: 'text-purple-400' },
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
    default:
      return '';
  }
}

export function ActivityTicker({ initialEvents, onEventVisible }: ActivityTickerProps) {
  const [events, setEvents] = useState<ActivityEvent[]>(initialEvents || []);
  const tickerRef = useRef<HTMLUListElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/governance/activity?limit=20');
      if (!res.ok) return;
      const data: ActivityEvent[] = await res.json();
      setEvents(data);
    } catch {}
  }, []);

  useEffect(() => {
    if (!initialEvents || initialEvents.length === 0) {
      fetchEvents();
    }

    pollRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchEvents();
      }
    }, 60_000);

    return () => clearInterval(pollRef.current);
  }, [fetchEvents, initialEvents]);

  // Notify parent when event DRep is "visible" in ticker for canvas pulse sync
  useEffect(() => {
    if (!onEventVisible || events.length === 0) return;

    let idx = 0;
    const interval = setInterval(() => {
      const event = events[idx % events.length];
      if (event.drepId) {
        onEventVisible(event.drepId);
      }
      idx++;
    }, 4000);

    return () => clearInterval(interval);
  }, [events, onEventVisible]);

  if (events.length === 0) return null;

  // Duplicate events for seamless scroll loop
  const displayEvents = [...events, ...events];

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 overflow-hidden bg-black/50 backdrop-blur-md border-t border-white/5">
      <ul
        ref={tickerRef}
        className="flex items-center gap-8 px-4 py-2.5 animate-ticker whitespace-nowrap"
        aria-live="polite"
        aria-label="Recent governance activity"
        style={{
          animationDuration: `${Math.max(15, displayEvents.length * 2)}s`,
        }}
      >
        {displayEvents.map((event, i) => {
          const config = EVENT_ICONS[event.type] || EVENT_ICONS.vote;
          const Icon = config.icon;
          return (
            <li
              key={`${event.timestamp}-${i}`}
              className="flex items-center gap-2 text-sm shrink-0"
            >
              <Icon className={`h-3.5 w-3.5 ${config.color} shrink-0`} />
              <span className="text-white/70">{formatEventText(event)}</span>
              <span className="text-white/30 text-xs">{formatRelativeTime(event.timestamp)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
