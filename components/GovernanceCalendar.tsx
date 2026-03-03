'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, AlertTriangle } from 'lucide-react';
import { posthog } from '@/lib/posthog';

interface CalendarData {
  currentEpoch: number;
  secondsRemaining: number;
  epochProgress: number;
  upcoming: {
    txHash: string;
    index: number;
    title: string;
    proposalType: string;
    epochsLeft: number | null;
    daysLeft: number | null;
  }[];
}

function formatCountdown(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function GovernanceCalendar() {
  const [data, setData] = useState<CalendarData | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/governance/calendar')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setData(d);
          setCountdown(d.secondsRemaining);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Governance Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Epoch {data.currentEpoch}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {countdown !== null ? formatCountdown(countdown) : '...'} remaining
            </p>
          </div>
          <div className="w-24">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${data.epochProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-right mt-0.5 tabular-nums">
              {data.epochProgress}%
            </p>
          </div>
        </div>

        {data.upcoming.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Expiring Soon
            </p>
            {data.upcoming.slice(0, 5).map((p) => (
              <Link
                key={`${p.txHash}-${p.index}`}
                href={`/proposals/${p.txHash}/${p.index}`}
                className="flex items-center gap-2 text-xs hover:bg-muted/50 rounded px-2 py-1.5 -mx-2 transition-colors"
                onClick={() =>
                  posthog.capture('calendar_proposal_clicked', { epochs_left: p.epochsLeft })
                }
              >
                {p.epochsLeft !== null && p.epochsLeft <= 1 && (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                )}
                <span className="truncate flex-1">{p.title}</span>
                {p.daysLeft !== null && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      p.epochsLeft !== null && p.epochsLeft <= 1
                        ? 'text-red-600 dark:text-red-400 border-red-300 dark:border-red-800'
                        : p.epochsLeft !== null && p.epochsLeft <= 2
                          ? 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                          : 'text-muted-foreground border-border'
                    }`}
                  >
                    ~{p.daysLeft}d
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
