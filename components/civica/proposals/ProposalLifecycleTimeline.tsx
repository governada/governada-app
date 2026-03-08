'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, CheckCircle2, XCircle, AlertTriangle, Hourglass } from 'lucide-react';

interface TimelineEvent {
  epoch: number;
  label: string;
  status: 'past' | 'current' | 'future';
  icon: typeof Clock;
  color: string;
}

interface ProposalLifecycleTimelineProps {
  proposedEpoch: number | null;
  expirationEpoch: number | null;
  ratifiedEpoch: number | null;
  enactedEpoch: number | null;
  droppedEpoch: number | null;
  expiredEpoch: number | null;
  currentEpoch: number;
}

export function ProposalLifecycleTimeline({
  proposedEpoch,
  expirationEpoch,
  ratifiedEpoch,
  enactedEpoch,
  droppedEpoch,
  expiredEpoch,
  currentEpoch,
}: ProposalLifecycleTimelineProps) {
  if (!proposedEpoch) return null;

  const events: TimelineEvent[] = [];

  // Proposed
  events.push({
    epoch: proposedEpoch,
    label: 'Proposed',
    status: 'past',
    icon: Clock,
    color: 'text-blue-400',
  });

  // Ratified
  if (ratifiedEpoch) {
    events.push({
      epoch: ratifiedEpoch,
      label: 'Ratified',
      status: 'past',
      icon: CheckCircle2,
      color: 'text-sky-400',
    });
  }

  // Enacted
  if (enactedEpoch) {
    events.push({
      epoch: enactedEpoch,
      label: 'Enacted',
      status: 'past',
      icon: CheckCircle2,
      color: 'text-emerald-400',
    });
  }

  // Dropped
  if (droppedEpoch) {
    events.push({
      epoch: droppedEpoch,
      label: 'Dropped',
      status: 'past',
      icon: XCircle,
      color: 'text-red-400',
    });
  }

  // Expired
  if (expiredEpoch) {
    events.push({
      epoch: expiredEpoch,
      label: 'Expired',
      status: 'past',
      icon: AlertTriangle,
      color: 'text-muted-foreground',
    });
  }

  // If still open, show current epoch and expiration
  const isOpen = !ratifiedEpoch && !enactedEpoch && !droppedEpoch && !expiredEpoch;
  if (isOpen) {
    events.push({
      epoch: currentEpoch,
      label: 'Now',
      status: 'current',
      icon: Hourglass,
      color: 'text-amber-400',
    });

    if (expirationEpoch && expirationEpoch > currentEpoch) {
      events.push({
        epoch: expirationEpoch,
        label: 'Expires',
        status: 'future',
        icon: AlertTriangle,
        color: 'text-muted-foreground/50',
      });
    }
  }

  // Sort by epoch
  events.sort((a, b) => a.epoch - b.epoch);

  if (events.length < 2) return null;

  const minEpoch = events[0].epoch;
  const maxEpoch = events[events.length - 1].epoch;
  const range = maxEpoch - minEpoch || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Lifecycle
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Timeline bar */}
        <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-6">
          {/* Progress fill */}
          {isOpen && expirationEpoch ? (
            <div
              className="absolute h-full bg-primary/30 rounded-full"
              style={{
                left: '0%',
                width: `${Math.min(((currentEpoch - minEpoch) / range) * 100, 100)}%`,
              }}
            />
          ) : (
            <div className="absolute h-full bg-primary/30 rounded-full w-full" />
          )}
        </div>

        {/* Event dots + labels */}
        <div className="relative" style={{ height: '3rem' }}>
          {events.map((event) => {
            const pct = ((event.epoch - minEpoch) / range) * 100;
            const Icon = event.icon;
            return (
              <div
                key={`${event.label}-${event.epoch}`}
                className="absolute flex flex-col items-center -translate-x-1/2"
                style={{ left: `${pct}%` }}
              >
                <div
                  className={cn(
                    'rounded-full p-1',
                    event.status === 'current'
                      ? 'bg-amber-500/20 ring-2 ring-amber-500/40'
                      : event.status === 'future'
                        ? 'bg-muted'
                        : 'bg-card',
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', event.color)} />
                </div>
                <span
                  className={cn(
                    'text-[10px] mt-1 whitespace-nowrap font-medium tabular-nums',
                    event.status === 'future'
                      ? 'text-muted-foreground/50'
                      : 'text-muted-foreground',
                  )}
                >
                  {event.label}
                  <span className="opacity-60 ml-0.5">E{event.epoch}</span>
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
