'use client';

import { useMemo } from 'react';
import { useGovernanceTimeline } from '@/hooks/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Vote, Users, TrendingUp, TrendingDown, CheckCircle, Star, Clock } from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  drepId: string | null;
  proposalTxHash: string | null;
  proposalIndex: number | null;
  epoch: number | null;
  createdAt: string;
}

const EVENT_CONFIG: Record<
  string,
  {
    icon: typeof Vote;
    label: (data: Record<string, unknown>) => string;
    dotColor: string;
  }
> = {
  poll_vote: {
    icon: Vote,
    label: (d) => {
      const vote =
        String(d.vote || '')
          .charAt(0)
          .toUpperCase() + String(d.vote || '').slice(1);
      const title = d.proposalTitle ? `on "${d.proposalTitle}"` : 'on a proposal';
      return `You voted ${vote} ${title}`;
    },
    dotColor: 'bg-blue-500',
  },
  delegation_change: {
    icon: Users,
    label: (d) => `You delegated to ${d.drepName || 'a DRep'}`,
    dotColor: 'bg-blue-500',
  },
  drep_vote: {
    icon: Vote,
    label: (d) => {
      const vote = String(d.vote || '');
      const title = d.proposalTitle ? `on "${d.proposalTitle}"` : 'on a proposal';
      return `Your DRep voted ${vote} ${title}`;
    },
    dotColor: 'bg-blue-500',
  },
  score_change: {
    icon: TrendingUp,
    label: (d) => {
      const delta = Number(d.delta || 0);
      const sign = delta >= 0 ? '+' : '';
      return `Your DRep's score changed by ${sign}${delta} to ${d.newScore ?? '?'}`;
    },
    dotColor: 'bg-blue-500',
  },
  proposal_outcome: {
    icon: CheckCircle,
    label: (d) => {
      const title = d.proposalTitle || 'A proposal';
      return `${title} was ${d.outcome || 'resolved'}`;
    },
    dotColor: 'bg-blue-500',
  },
  level_up: {
    icon: Star,
    label: (d) => `You reached ${d.level || 'a new'} status!`,
    dotColor: 'bg-green-500',
  },
};

function getEventConfig(event: TimelineEvent) {
  const config = EVENT_CONFIG[event.type];
  if (!config) {
    return {
      icon: Clock,
      label: `${event.type} event`,
      dotColor: 'bg-muted-foreground',
    };
  }

  let dotColor = config.dotColor;
  if (event.type === 'score_change') {
    const delta = Number(event.data.delta || 0);
    dotColor = delta > 0 ? 'bg-green-500' : delta < 0 ? 'bg-red-500' : 'bg-blue-500';
  } else if (event.type === 'proposal_outcome') {
    const outcome = String(event.data.outcome || '').toLowerCase();
    dotColor =
      outcome === 'passed' || outcome === 'enacted'
        ? 'bg-green-500'
        : outcome === 'failed' || outcome === 'dropped'
          ? 'bg-red-500'
          : 'bg-blue-500';
  }

  return {
    icon:
      event.type === 'score_change' && Number(event.data.delta || 0) < 0
        ? TrendingDown
        : config.icon,
    label: config.label(event.data),
    dotColor,
  };
}

export function GovernanceTimeline() {
  const { data: rawData, isLoading, isError } = useGovernanceTimeline();
  const events = ((rawData as { events?: TimelineEvent[] })?.events) ?? [];

  const grouped = useMemo(() => {
    const map = new Map<number | 'unknown', TimelineEvent[]>();
    for (const event of events) {
      const key = event.epoch ?? 'unknown';
      const arr = map.get(key) || [];
      arr.push(event);
      map.set(key, arr);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === 'unknown') return 1;
      if (b[0] === 'unknown') return -1;
      return (b[0] as number) - (a[0] as number);
    });
  }, [events]);

  if (isLoading) return <TimelineSkeleton />;
  if (isError) return <p className="text-destructive text-center py-8 text-sm">Could not load your governance timeline.</p>;

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Your Governance Journey
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 space-y-2">
            <Clock className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Your governance journey starts here. Cast a poll vote to begin building your timeline.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Your Governance Journey
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {grouped.map(([epoch, epochEvents]) => (
          <div key={String(epoch)}>
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              {epoch === 'unknown' ? 'Earlier' : `Epoch ${epoch}`}
            </div>
            <div className="relative ml-3 border-l border-border pl-4 space-y-3">
              {epochEvents.map((event) => {
                const config = getEventConfig(event);
                const Icon = config.icon;
                return (
                  <div key={event.id} className="relative flex items-start gap-3 text-sm">
                    <span
                      className={`absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-background ${config.dotColor}`}
                    />
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-relaxed">{config.label}</p>
                      <time className="text-[10px] text-muted-foreground">
                        {new Date(event.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TimelineSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-4 w-4 rounded-full shrink-0" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
