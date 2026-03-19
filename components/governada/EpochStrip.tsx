'use client';

import { useEpochContext } from '@/hooks/useEpochContext';
import { useTranslation } from '@/lib/i18n/useTranslation';

/**
 * Inline epoch display for the compressed header.
 * Shows epoch number, time remaining, and active proposal count.
 * Hidden on screens < 640px.
 */
export function EpochStrip() {
  const { epoch, day, totalDays, activeProposalCount } = useEpochContext();
  const { t } = useTranslation();

  // Compute hours remaining in the epoch
  // Each epoch = 5 days. Remaining days = totalDays - day, plus rest of current day (~24h approximation)
  const remainingDays = totalDays - day;
  const hoursRemaining = remainingDays * 24;

  const timeLabel =
    hoursRemaining >= 24
      ? `${remainingDays}d ${t('left')}`
      : hoursRemaining > 0
        ? `${hoursRemaining}h ${t('left')}`
        : t('ending');

  const proposalLabel =
    activeProposalCount !== null ? `${activeProposalCount} ${t('active')}` : null;

  const ariaDescription = [
    `${t('Epoch')} ${epoch}`,
    `${t('Day')} ${day} ${t('of')} ${totalDays}`,
    proposalLabel ? `${activeProposalCount} ${t('active proposals')}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground font-mono tabular-nums"
      aria-label={ariaDescription}
      role="status"
    >
      <span>
        {t('Ep')} {epoch}
      </span>
      <span className="text-muted-foreground/40">&middot;</span>
      <span>{timeLabel}</span>
      {proposalLabel && (
        <>
          <span className="text-muted-foreground/40">&middot;</span>
          <span>{proposalLabel}</span>
        </>
      )}
    </div>
  );
}
