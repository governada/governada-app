'use client';

import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Landmark, TrendingUp, TrendingDown, Minus, Clock, Shield, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { formatAda } from '@/lib/treasury';
import { posthog } from '@/lib/posthog';
import { useTreasuryCurrent } from '@/hooks/queries';

interface TreasuryWidgetData {
  balance: number;
  runwayMonths: number;
  trend: 'growing' | 'shrinking' | 'stable';
  healthScore: number | null;
  pendingCount: number;
  pendingTotalAda: number;
}

export function TreasuryHealthWidget() {
  const { data: raw } = useTreasuryCurrent();
  const data = raw as TreasuryWidgetData | undefined;

  useEffect(() => {
    if (data)
      posthog.capture('treasury_widget_viewed', {
        health_score: data.healthScore,
        balance: data.balance,
      });
  }, [data]);

  if (!data) return null;

  const trendIcon =
    data.trend === 'growing' ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : data.trend === 'shrinking' ? (
      <TrendingDown className="h-4 w-4 text-red-500" />
    ) : (
      <Minus className="h-4 w-4 text-muted-foreground" />
    );

  const healthColor = !data.healthScore
    ? 'text-muted-foreground'
    : data.healthScore >= 75
      ? 'text-green-500'
      : data.healthScore >= 50
        ? 'text-amber-500'
        : 'text-red-500';

  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Treasury Health</span>
          </div>
          <Link
            href="/governance/health"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Full dashboard <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Balance</div>
            <div className="text-lg font-bold tabular-nums flex items-center gap-1">
              {formatAda(data.balance)}
              {trendIcon}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Runway</div>
            <div className="text-lg font-bold tabular-nums flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {data.runwayMonths >= 999 ? '∞' : `${data.runwayMonths}mo`}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Health</div>
            <div
              className={`text-lg font-bold tabular-nums flex items-center gap-1 ${healthColor}`}
            >
              <Shield className="h-3.5 w-3.5" />
              {data.healthScore ?? '—'}/100
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Pending</div>
            <div className="text-lg font-bold tabular-nums">
              {data.pendingCount > 0
                ? `${data.pendingCount} (${formatAda(data.pendingTotalAda)})`
                : '0'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
