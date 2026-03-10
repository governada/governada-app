'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, CheckCircle2, XCircle, AlertTriangle, Hourglass } from 'lucide-react';

/**
 * Convert a Cardano epoch number to an approximate date.
 * Shelley genesis: epoch 209 started at Unix 1596491091.
 * Each epoch = 5 days (432000 seconds).
 */
function epochToDate(epoch: number): Date {
  const SHELLEY_GENESIS_TIMESTAMP = 1596491091;
  const EPOCH_LENGTH_SECONDS = 432000;
  const SHELLEY_BASE_EPOCH = 209;
  const timestamp = SHELLEY_GENESIS_TIMESTAMP + (epoch - SHELLEY_BASE_EPOCH) * EPOCH_LENGTH_SECONDS;
  return new Date(timestamp * 1000);
}

function formatEpochLabel(epoch: number): string {
  const date = epochToDate(epoch);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  return `E${epoch} \u00B7 ${month} ${day}`;
}

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

        {/* Event dots + labels — alternate above/below for dense timelines */}
        <div className="relative" style={{ height: '5rem' }}>
          {events.map((event, idx) => {
            const pct = ((event.epoch - minEpoch) / range) * 100;
            const Icon = event.icon;
            const isBelow = idx % 2 === 0;
            return (
              <div
                key={`${event.label}-${event.epoch}`}
                className={cn(
                  'absolute flex items-center -translate-x-1/2',
                  isBelow ? 'flex-col top-[1.25rem]' : 'flex-col-reverse bottom-[1.25rem]',
                )}
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
                    'text-[9px] mt-1 whitespace-nowrap font-medium tabular-nums leading-tight text-center',
                    event.status === 'future'
                      ? 'text-muted-foreground/50'
                      : 'text-muted-foreground',
                    !isBelow && 'mb-1 mt-0',
                  )}
                >
                  {event.label}
                  <br />
                  <span className="opacity-60">{formatEpochLabel(event.epoch)}</span>
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
