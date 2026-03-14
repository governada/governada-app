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

/**
 * Merge events that are within 1 epoch of each other to prevent overlap.
 * Combined events get a joined label like "Proposed / Now".
 */
function mergeCloseEvents(events: TimelineEvent[]): TimelineEvent[] {
  if (events.length <= 1) return events;

  const merged: TimelineEvent[] = [];
  let i = 0;

  while (i < events.length) {
    const current = { ...events[i] };
    let j = i + 1;

    // Merge any subsequent events within 1 epoch
    while (j < events.length && events[j].epoch - current.epoch <= 1) {
      current.label = `${current.label} / ${events[j].label}`;
      // Use the more "active" status and its icon/color
      if (events[j].status === 'current') {
        current.status = 'current';
        current.icon = events[j].icon;
        current.color = events[j].color;
      }
      // Use the later epoch for positioning
      current.epoch = events[j].epoch;
      j++;
    }

    merged.push(current);
    i = j;
  }

  return merged;
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

  // Sort by epoch then merge close events
  events.sort((a, b) => a.epoch - b.epoch);
  const merged = mergeCloseEvents(events);

  if (merged.length < 2) return null;

  // Time remaining for open proposals
  const remaining = isOpen && expirationEpoch ? Math.max(0, expirationEpoch - currentEpoch) : null;
  const remainingDays = remaining != null ? remaining * 5 : null;

  // Derive terminal state for outcome-specific styling
  const terminalState: 'enacted' | 'ratified' | 'dropped' | 'expired' | 'open' = enactedEpoch
    ? 'enacted'
    : ratifiedEpoch
      ? 'ratified'
      : droppedEpoch
        ? 'dropped'
        : expiredEpoch
          ? 'expired'
          : 'open';

  const cardRing = {
    enacted: 'ring-1 ring-emerald-500/20',
    ratified: 'ring-1 ring-emerald-500/20',
    dropped: 'ring-1 ring-red-500/20',
    expired: 'ring-1 ring-muted-foreground/20',
    open: '',
  }[terminalState];

  const titleIcon = {
    enacted: CheckCircle2,
    ratified: CheckCircle2,
    dropped: XCircle,
    expired: AlertTriangle,
    open: Clock,
  }[terminalState];

  const titleIconColor = {
    enacted: 'text-emerald-500',
    ratified: 'text-emerald-500',
    dropped: 'text-red-400',
    expired: 'text-muted-foreground',
    open: '',
  }[terminalState];

  const TitleIcon = titleIcon;

  // Use flex layout for clean spacing — no absolute positioning overlap issues
  return (
    <Card className={cardRing}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <TitleIcon className={cn('h-4 w-4', titleIconColor)} />
            Lifecycle
          </CardTitle>
          {remainingDays != null && remaining != null && remaining > 0 && (
            <span
              className={cn(
                'text-xs font-medium',
                remaining <= 2 ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground',
              )}
            >
              ~{remainingDays} days left
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Flex-based timeline — evenly spaced events with connected segments */}
        <div className="flex items-start">
          {merged.map((event, idx) => {
            const Icon = event.icon;
            const isLast = idx === merged.length - 1;

            // Progress fill: past segments are filled, current-to-future is partial
            const segmentFilled =
              idx < merged.length - 1 &&
              (merged[idx + 1].status === 'past' ||
                (event.status === 'past' && merged[idx + 1].status === 'current'));

            return (
              <div
                key={`${event.label}-${event.epoch}`}
                className="flex items-start flex-1 min-w-0"
              >
                {/* Event marker + label */}
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className={cn(
                      'rounded-full p-1.5',
                      event.status === 'current'
                        ? 'bg-amber-500/20 ring-2 ring-amber-500/40'
                        : event.status === 'future'
                          ? 'bg-muted'
                          : 'bg-primary/10',
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5', event.color)} />
                  </div>
                  <span
                    className={cn(
                      'text-[10px] mt-1.5 font-medium text-center leading-tight',
                      event.status === 'future'
                        ? 'text-muted-foreground/50'
                        : 'text-muted-foreground',
                    )}
                  >
                    {event.label}
                  </span>
                  <span className="text-[9px] text-muted-foreground/50 tabular-nums text-center">
                    {formatEpochLabel(event.epoch)}
                  </span>
                </div>

                {/* Connector segment */}
                {!isLast && (
                  <div className="flex-1 flex items-center px-1 pt-[0.85rem]">
                    <div
                      className={cn(
                        'h-0.5 w-full rounded-full',
                        segmentFilled
                          ? terminalState === 'expired' || terminalState === 'dropped'
                            ? 'bg-muted-foreground/20'
                            : 'bg-primary/40'
                          : 'bg-border',
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
