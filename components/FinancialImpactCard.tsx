'use client';

import { useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingDown, AlertTriangle, Landmark, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { formatAda } from '@/lib/treasury';
import { posthog } from '@/lib/posthog';

interface FinancialImpactCardProps {
  withdrawalAda: number;
  treasuryBalanceAda?: number;
  runwayMonths?: number;
  runwayImpactMonths?: number;
  treasuryTier?: string | null;
  compact?: boolean;
}

export function FinancialImpactCard({
  withdrawalAda,
  treasuryBalanceAda,
  runwayMonths,
  runwayImpactMonths,
  treasuryTier,
  compact = false,
}: FinancialImpactCardProps) {
  useEffect(() => {
    if (!compact) {
      posthog.capture('financial_impact_card_viewed', {
        withdrawal_ada: withdrawalAda,
        treasury_tier: treasuryTier,
        pct_of_treasury: treasuryBalanceAda
          ? ((withdrawalAda / treasuryBalanceAda) * 100).toFixed(2)
          : null,
      });
    }
  }, [withdrawalAda, treasuryTier, treasuryBalanceAda, compact]);

  const pctOfTreasury = useMemo(() => {
    if (!treasuryBalanceAda || treasuryBalanceAda <= 0) return null;
    return ((withdrawalAda / treasuryBalanceAda) * 100).toFixed(2);
  }, [withdrawalAda, treasuryBalanceAda]);

  const tierColors: Record<string, string> = {
    routine: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30',
    significant: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30',
    major: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30',
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Landmark className="h-3.5 w-3.5" />
        <span>{formatAda(withdrawalAda)} ADA</span>
        {pctOfTreasury && <span className="text-xs">({pctOfTreasury}% of treasury)</span>}
      </div>
    );
  }

  return (
    <Card className={tierColors[treasuryTier || ''] || 'bg-muted/30'}>
      <CardContent className="pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-2 font-medium">
          <Landmark className="h-4 w-4" />
          <span>Treasury Impact</span>
        </div>

        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Withdrawal amount</span>
            <span className="font-semibold">{formatAda(withdrawalAda)} ADA</span>
          </div>

          {pctOfTreasury && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">% of treasury</span>
              <span className="font-semibold">{pctOfTreasury}%</span>
            </div>
          )}

          {runwayMonths !== undefined && runwayImpactMonths !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-3.5 w-3.5" />
                Runway impact
              </span>
              <span className="font-semibold">
                {runwayMonths}mo → {Math.max(0, runwayMonths - runwayImpactMonths)}mo
              </span>
            </div>
          )}

          {treasuryTier === 'major' && (
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-xs mt-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Major treasury withdrawal — significant budget impact
            </div>
          )}
        </div>

        <Link
          href="/governance/health"
          className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
        >
          View full treasury dashboard <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
