'use client';

/**
 * CommunityTemperature — enhanced sentiment display showing early signal strength.
 *
 * Uses existing citizen sentiment data from ReviewQueueItem. Shows:
 * - Support/oppose bar with percentage + voter count
 * - Signal strength indicator (how many unique voters have weighed in)
 * - Visual confidence band based on total participation
 */

import { Thermometer, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CitizenSentiment } from '@/lib/workspace/types';

interface CommunityTemperatureProps {
  sentiment: CitizenSentiment | null;
}

function SignalStrengthDots({ total }: { total: number }) {
  // 1-5 voters = 1 dot, 6-15 = 2, 16-30 = 3, 31-50 = 4, 50+ = 5
  const dots =
    total === 0 ? 0 : total <= 5 ? 1 : total <= 15 ? 2 : total <= 30 ? 3 : total <= 50 ? 4 : 5;

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn('h-1.5 w-1.5 rounded-full', i < dots ? 'bg-primary' : 'bg-muted')}
        />
      ))}
    </div>
  );
}

export function CommunityTemperature({ sentiment }: CommunityTemperatureProps) {
  if (!sentiment || sentiment.total === 0) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Thermometer className="h-3.5 w-3.5" />
            Community Temperature
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            No citizen signals yet. Be the first to weigh in.
          </p>
        </CardContent>
      </Card>
    );
  }

  const supportPct = Math.round((sentiment.support / sentiment.total) * 100);
  const opposePct = Math.round((sentiment.oppose / sentiment.total) * 100);
  const abstainPct = 100 - supportPct - opposePct;

  const signalLabel =
    sentiment.total <= 5
      ? 'Very Early'
      : sentiment.total <= 15
        ? 'Early'
        : sentiment.total <= 30
          ? 'Building'
          : sentiment.total <= 50
            ? 'Strong'
            : 'Very Strong';

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Thermometer className="h-3.5 w-3.5" />
            Community Temperature
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Users className="h-3 w-3" />
            {sentiment.total} signals
          </div>
        </div>

        {/* Support/Oppose bar */}
        <div className="space-y-1.5">
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted flex">
            {supportPct > 0 && (
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${supportPct}%` }}
              />
            )}
            {abstainPct > 0 && (
              <div
                className="h-full bg-muted-foreground/20 transition-all duration-500"
                style={{ width: `${abstainPct}%` }}
              />
            )}
            {opposePct > 0 && (
              <div
                className="h-full bg-rose-500 transition-all duration-500"
                style={{ width: `${opposePct}%` }}
              />
            )}
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {supportPct}% Support ({sentiment.support})
            </span>
            {sentiment.abstain > 0 && (
              <span className="text-muted-foreground">
                {abstainPct}% Abstain ({sentiment.abstain})
              </span>
            )}
            <span className="text-rose-600 dark:text-rose-400 font-medium">
              {opposePct}% Oppose ({sentiment.oppose})
            </span>
          </div>
        </div>

        {/* Signal strength */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Signal Strength</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-foreground">{signalLabel}</span>
            <SignalStrengthDots total={sentiment.total} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
