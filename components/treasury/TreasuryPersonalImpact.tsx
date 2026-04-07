'use client';

import { Wallet } from 'lucide-react';
import { formatAda } from '@/lib/treasury';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet';
import { useTreasuryPending } from '@/hooks/queries';
import { useDRepTreasuryRecord } from '@/hooks/useDRepTreasuryRecord';
import { DepthGate } from '@/components/providers/DepthGate';
import { useLocale } from '@/components/providers/LocaleProvider';
import { formatLocaleNumber } from '@/lib/i18n/format';

/** Approximate circulating ADA supply (~37B). Updated periodically by sync. */
const CIRCULATING_SUPPLY_ADA = 37_000_000_000;

interface TreasuryPersonalImpactProps {
  balanceAda: number;
  nclRemainingAda: number | null;
  nclAda: number | null;
  nclUtilizationPct: number | null;
}

export function TreasuryPersonalImpact({
  balanceAda: treasuryBalanceAda,
  nclRemainingAda,
  nclAda,
  nclUtilizationPct,
}: TreasuryPersonalImpactProps) {
  const { locale } = useLocale();
  const { segment, drepId } = useSegment();
  const { delegatedDrepId, balanceAda: walletBalanceAda } = useWallet();

  // DReps see their own record; citizens see their delegated DRep's record
  const effectiveDrepId = segment === 'drep' ? drepId : delegatedDrepId;
  const isCitizen = segment === 'citizen';

  const { data: rawRecord } = useDRepTreasuryRecord(effectiveDrepId);

  const { data: rawPending } = useTreasuryPending();
  const pending = rawPending as { totalAda: number; proposals: unknown[] } | undefined;

  const record = rawRecord?.record;
  const hasDRepData = !!record && record.totalProposals > 0;

  // Compute what-if: if all pending pass, new utilization
  const pendingTotalAda = pending?.totalAda ?? 0;
  const postPendingUtilization =
    nclAda && nclRemainingAda != null && nclUtilizationPct != null
      ? Math.round(((nclAda - nclRemainingAda + pendingTotalAda) / nclAda) * 100)
      : null;

  // Proportional share: (userAda / circulatingSupply) * treasuryBalance
  const proportionalShare =
    walletBalanceAda && walletBalanceAda > 0 && treasuryBalanceAda > 0
      ? (walletBalanceAda / CIRCULATING_SUPPLY_ADA) * treasuryBalanceAda
      : null;

  if (!hasDRepData && pendingTotalAda === 0 && proportionalShare === null) return null;

  const label = isCitizen ? "Your DRep's" : 'Your';

  return (
    <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5">
      <h3 className="text-sm font-semibold mb-3">
        {isCitizen ? "Your DRep's Treasury Impact" : 'Your Treasury Impact'}
      </h3>

      <div className="space-y-3">
        {/* Proportional treasury share */}
        {proportionalShare !== null && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="h-3.5 w-3.5 shrink-0" />
            <span>
              Your proportional share of the treasury:{' '}
              <span className="font-semibold text-foreground">
                ₳{formatLocaleNumber(proportionalShare, locale, { maximumFractionDigits: 0 })}
              </span>
            </span>
          </div>
        )}

        {/* DRep voting record & judgment — engaged+ (detailed analysis) */}
        <DepthGate minDepth="engaged">
          {hasDRepData && record && (
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">{label} approved </span>
                <span className="font-semibold text-emerald-400">
                  ₳{formatAda(record.approvedAda)}
                </span>
                <span className="text-muted-foreground text-xs ml-1">
                  ({record.approvedCount} proposals)
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{label} opposed </span>
                <span className="font-semibold text-red-400">₳{formatAda(record.opposedAda)}</span>
                <span className="text-muted-foreground text-xs ml-1">({record.opposedCount})</span>
              </div>
              {record.abstainedCount > 0 && (
                <div>
                  <span className="text-muted-foreground">Abstained </span>
                  <span className="font-semibold">{record.abstainedCount}</span>
                </div>
              )}
            </div>
          )}

          {/* Judgment score */}
          {hasDRepData && record?.judgmentScore !== null && record?.judgmentScore !== undefined && (
            <div className="text-sm">
              <span className="text-muted-foreground">
                Of what {isCitizen ? 'they' : 'you'} approved,{' '}
              </span>
              <span className="font-semibold">{record.judgmentScore}%</span>
              <span className="text-muted-foreground"> delivered results</span>
            </div>
          )}
        </DepthGate>

        {/* Pending impact projection — engaged+ */}
        <DepthGate minDepth="engaged">
          {pendingTotalAda > 0 && (
            <div className="text-sm text-muted-foreground pt-2 border-t border-border/30">
              If all {pending?.proposals.length ?? 0} pending proposals pass:{' '}
              <span className="font-semibold text-foreground">₳{formatAda(pendingTotalAda)}</span>{' '}
              leaves the treasury
              {postPendingUtilization !== null && nclUtilizationPct !== null && (
                <span>
                  {' '}
                  — budget utilization{' '}
                  <span className="font-semibold text-foreground">
                    {Math.round(nclUtilizationPct)}% → {postPendingUtilization}%
                  </span>
                </span>
              )}
            </div>
          )}
        </DepthGate>
      </div>
    </div>
  );
}
