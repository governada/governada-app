'use client';

import { useEffect, useState } from 'react';
import { useProposalPower } from '@/hooks/queries';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ThresholdMeterProps {
  txHash: string;
  proposalIndex: number;
  proposalType: string;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  totalVotes: number;
  isOpen: boolean;
  variant?: 'compact' | 'full';
}

interface PowerData {
  yesPower: number;
  noPower: number;
  abstainPower: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  totalActivePower: number;
  threshold: number | null;
  thresholdLabel: string | null;
}

function formatAdaCompact(lovelace: number): string {
  const ada = lovelace / 1_000_000;
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(1)}K`;
  return `${Math.round(ada)}`;
}

export function ThresholdMeter({
  txHash,
  proposalIndex,
  proposalType,
  yesCount,
  noCount,
  abstainCount,
  totalVotes,
  isOpen,
  variant = 'compact',
}: ThresholdMeterProps) {
  const { data: powerData } = useProposalPower(txHash, proposalIndex, proposalType);
  const power = (powerData as PowerData) ?? null;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (power) {
      const t = setTimeout(() => setMounted(true), 50);
      return () => clearTimeout(t);
    }
  }, [power]);

  const hasPowerData =
    power && power.totalActivePower > 0 && power.yesPower + power.noPower + power.abstainPower > 0;
  const isInfoAction = proposalType === 'InfoAction';

  if (!hasPowerData || isInfoAction) {
    return (
      <CountBasedBar
        yesCount={yesCount}
        noCount={noCount}
        abstainCount={abstainCount}
        totalVotes={totalVotes}
        isInfoAction={isInfoAction}
        variant={variant}
      />
    );
  }

  const yesPercent =
    power.totalActivePower > 0 ? (power.yesPower / power.totalActivePower) * 100 : 0;
  const threshold = power.threshold;
  const thresholdPct = threshold ? threshold * 100 : null;
  const isPassing = thresholdPct !== null && yesPercent >= thresholdPct;

  if (variant === 'compact') {
    return (
      <CompactMeter
        yesPercent={yesPercent}
        thresholdPct={thresholdPct}
        isPassing={isPassing}
        isOpen={isOpen}
        yesPower={power.yesPower}
        totalActivePower={power.totalActivePower}
        noCount={power.noCount}
        mounted={mounted}
      />
    );
  }

  return (
    <FullMeter
      power={power}
      yesPercent={yesPercent}
      thresholdPct={thresholdPct}
      isPassing={isPassing}
      isOpen={isOpen}
      mounted={mounted}
    />
  );
}

function CountBasedBar({
  yesCount,
  noCount,
  abstainCount,
  totalVotes,
  isInfoAction,
  variant,
}: {
  yesCount: number;
  noCount: number;
  abstainCount: number;
  totalVotes: number;
  isInfoAction: boolean;
  variant: 'compact' | 'full';
}) {
  if (totalVotes === 0) return <span className="text-xs text-muted-foreground">No votes yet</span>;

  const yp = (yesCount / totalVotes) * 100;
  const np = (noCount / totalVotes) * 100;
  const barHeight = variant === 'full' ? 'h-4' : 'h-2';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className={`flex-1 ${barHeight} rounded-full bg-muted overflow-hidden flex`}>
          <div className="bg-green-500 h-full" style={{ width: `${yp}%` }} />
          <div className="bg-red-500 h-full" style={{ width: `${np}%` }} />
          <div className="bg-amber-500 h-full flex-1" />
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] tabular-nums">
        <span className="text-green-600 dark:text-green-400 font-medium">{yesCount} Yes</span>
        <span className="text-red-600 dark:text-red-400 font-medium">{noCount} No</span>
        <span className="text-amber-600 dark:text-amber-400 font-medium">
          {abstainCount} Abstain
        </span>
        <span className="text-muted-foreground ml-auto">{totalVotes} DReps</span>
      </div>

      {isInfoAction && <p className="text-[10px] text-muted-foreground">Advisory — no threshold</p>}

      {variant === 'full' && !isInfoAction && (
        <div className="grid grid-cols-3 gap-4 text-center pt-2">
          <div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 tabular-nums">
              {yesCount}
            </p>
            <p className="text-xs text-muted-foreground">Yes</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
              {noCount}
            </p>
            <p className="text-xs text-muted-foreground">No</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {abstainCount}
            </p>
            <p className="text-xs text-muted-foreground">Abstain</p>
          </div>
        </div>
      )}

      {variant === 'full' && !isInfoAction && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 mt-2">
          <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <p className="text-[11px] text-muted-foreground">
            ADA-weighted pass threshold will appear once voting power data is indexed.
          </p>
        </div>
      )}
    </div>
  );
}

function CompactMeter({
  yesPercent,
  thresholdPct,
  isPassing,
  isOpen,
  yesPower,
  totalActivePower,
  noCount,
  mounted,
}: {
  yesPercent: number;
  thresholdPct: number | null;
  isPassing: boolean;
  isOpen: boolean;
  yesPower: number;
  totalActivePower: number;
  noCount: number;
  mounted: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${isPassing ? 'bg-green-500' : 'bg-green-500/70'}`}
          style={{ width: mounted ? `${Math.min(yesPercent, 100)}%` : '0%' }}
        />
        {thresholdPct !== null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground/40"
            style={{ left: `${thresholdPct}%` }}
          />
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {formatAdaCompact(yesPower)} / {formatAdaCompact(totalActivePower)} ADA
          {thresholdPct !== null && ` (${Math.round(thresholdPct)}% needed)`}
        </span>
        <div className="flex items-center gap-1.5">
          {noCount > 0 && (
            <span className="text-[10px] text-red-600 dark:text-red-400 tabular-nums">
              {noCount} No
            </span>
          )}
          {!isOpen && isPassing && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
            >
              Passed
            </Badge>
          )}
          {!isOpen && !isPassing && thresholdPct !== null && (
            <Badge variant="outline" className="text-[9px] px-1 text-muted-foreground">
              Did not pass
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function FullMeter({
  power,
  yesPercent,
  thresholdPct,
  isPassing,
  isOpen,
  mounted,
}: {
  power: PowerData;
  yesPercent: number;
  thresholdPct: number | null;
  isPassing: boolean;
  isOpen: boolean;
  mounted: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="relative h-4 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${isPassing ? 'bg-green-500' : 'bg-green-500/70'}`}
            style={{ width: mounted ? `${Math.min(yesPercent, 100)}%` : '0%' }}
          />
          {thresholdPct !== null && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-foreground/60 cursor-help"
                    style={{ left: `${thresholdPct}%` }}
                  >
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-medium text-muted-foreground whitespace-nowrap">
                      {Math.round(thresholdPct)}%
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{power.thresholdLabel}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div className="flex items-center justify-between">
          {isOpen ? (
            isPassing ? (
              <Badge
                variant="outline"
                className="text-[10px] bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
              >
                Currently passing
              </Badge>
            ) : thresholdPct !== null ? (
              <span className="text-[10px] text-muted-foreground">Needs more support to pass</span>
            ) : null
          ) : isPassing ? (
            <Badge
              variant="outline"
              className="text-[10px] bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
            >
              Passed
            </Badge>
          ) : thresholdPct !== null ? (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Did not pass
            </Badge>
          ) : null}
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {yesPercent.toFixed(1)}% Yes
            {thresholdPct !== null && ` / ${Math.round(thresholdPct)}% needed`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 tabular-nums">
            {power.yesCount}
          </p>
          <p className="text-xs text-muted-foreground">Yes</p>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {formatAdaCompact(power.yesPower)} ADA
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
            {power.noCount}
          </p>
          <p className="text-xs text-muted-foreground">No</p>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {formatAdaCompact(power.noPower)} ADA
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {power.abstainCount}
          </p>
          <p className="text-xs text-muted-foreground">Abstain</p>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {formatAdaCompact(power.abstainPower)} ADA
          </p>
        </div>
      </div>
    </div>
  );
}
