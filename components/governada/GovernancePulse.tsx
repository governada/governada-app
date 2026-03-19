'use client';

import { useEpochContext } from '@/hooks/useEpochContext';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type PulseStatus = 'calm' | 'active' | 'urgent';

const PULSE_COLORS: Record<PulseStatus, string> = {
  calm: 'oklch(0.68 0.16 162)', // compass teal
  active: 'oklch(0.75 0.15 85)', // amber
  urgent: 'oklch(0.65 0.2 25)', // red
};

const PULSE_LABELS: Record<PulseStatus, string> = {
  calm: 'Calm',
  active: 'Active',
  urgent: 'Urgent',
};

function getPulseStatus(day: number, activeProposalCount: number | null): PulseStatus {
  const hasActive = (activeProposalCount ?? 0) > 0;

  if (day >= 5 && hasActive) return 'urgent';
  if (day >= 4 && hasActive) return 'active';
  return 'calm';
}

/**
 * Governance pulse dot — colored indicator encoding governance urgency.
 * Green (calm): epoch days 1-3 or no active proposals.
 * Amber (active): day 4 with active proposals.
 * Red (urgent): day 5 with active proposals.
 * Pulses gently on amber/red states.
 */
export function GovernancePulse() {
  const { day, activeProposalCount } = useEpochContext();
  const { t } = useTranslation();

  const status = getPulseStatus(day, activeProposalCount);
  const color = PULSE_COLORS[status];
  const label = PULSE_LABELS[status];
  const shouldPulse = status !== 'calm';

  const tooltipText =
    status === 'calm'
      ? t('Governance is calm — no urgent deadlines')
      : status === 'active'
        ? t('Voting deadline approaching — proposals need attention')
        : t('Final day to vote — urgent action needed');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="relative flex items-center justify-center w-5 h-5 cursor-default"
            aria-label={`${t('Governance status')}: ${t(label)}`}
            role="status"
          >
            {/* Glow ring — visible on amber/red, pulses */}
            {shouldPulse && (
              <span
                className="absolute inset-0 rounded-full animate-pulse"
                style={{
                  backgroundColor: color,
                  opacity: 0.2,
                  animationDuration: '2s',
                }}
                aria-hidden="true"
              />
            )}
            {/* Core dot */}
            <span
              className={cn('relative block rounded-full', shouldPulse ? 'w-2.5 h-2.5' : 'w-2 h-2')}
              style={{
                backgroundColor: color,
                boxShadow: shouldPulse ? `0 0 6px 1px ${color}` : 'none',
              }}
              aria-hidden="true"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
