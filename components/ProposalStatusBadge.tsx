import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock } from 'lucide-react';
import {
  getProposalStatus,
  getProposalPriority,
  STATUS_STYLES,
  PRIORITY_STYLES,
  TYPE_EXPLAINERS,
  type ProposalStatus,
  type ProposalPriority,
} from '@/utils/proposalPriority';

const STATUS_TOOLTIPS: Record<string, string> = {
  open: 'This proposal is actively accepting DRep votes.',
  enacted: 'This proposal passed and has been implemented on-chain.',
  ratified: 'This proposal reached the required votes and is awaiting enactment.',
  expired: 'This proposal did not receive enough votes before its deadline.',
  dropped: 'This proposal was withdrawn or superseded.',
};

const PRIORITY_TOOLTIPS: Record<string, string> = {
  critical:
    "Critical proposals (like hard forks) can significantly impact the network. Your DRep's vote matters most here.",
  important:
    'Important proposals affect protocol parameters that influence fees, rewards, and network behavior.',
};

const TREASURY_TIER_TOOLTIPS: Record<string, string> = {
  routine: 'A routine treasury request under 1M ADA, funded by transaction fees.',
  significant: 'A significant treasury request (1M–20M ADA) requiring careful DRep consideration.',
  major: 'A major treasury request over 20M ADA — one of the largest types of proposals.',
};

interface StatusBadgeProps {
  ratifiedEpoch: number | null;
  enactedEpoch: number | null;
  droppedEpoch: number | null;
  expiredEpoch: number | null;
}

export function ProposalStatusBadge({
  ratifiedEpoch,
  enactedEpoch,
  droppedEpoch,
  expiredEpoch,
}: StatusBadgeProps) {
  const status = getProposalStatus({ ratifiedEpoch, enactedEpoch, droppedEpoch, expiredEpoch });
  const config = STATUS_STYLES[status];
  const tooltip = STATUS_TOOLTIPS[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`text-[10px] cursor-help ${config.className}`}>
            {config.label}
          </Badge>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent side="bottom" className="max-w-[240px]">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

export function PriorityBadge({ proposalType }: { proposalType: string }) {
  const priority = getProposalPriority(proposalType);
  if (priority === 'standard') return null;
  const config = PRIORITY_STYLES[priority];
  const tooltip = PRIORITY_TOOLTIPS[priority];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`text-[10px] cursor-help ${config.className}`}>
            {config.label}
          </Badge>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent side="bottom" className="max-w-[260px]">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

export function DeadlineBadge({
  expirationEpoch,
  currentEpoch,
}: {
  expirationEpoch: number | null;
  currentEpoch: number;
}) {
  if (expirationEpoch == null) return null;
  const remaining = Math.max(0, expirationEpoch - currentEpoch);
  if (remaining === 0) return null;

  const daysApprox = remaining * 5;
  const urgentVariant =
    remaining <= 1
      ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30'
      : remaining <= 2
        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
        : '';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`text-[10px] gap-1 cursor-help ${urgentVariant}`}>
            <Clock className="h-3 w-3" />
            {remaining} epoch{remaining !== 1 ? 's' : ''} left
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px]">
          <p className="text-xs">
            Expires in ~{daysApprox} days. If not enough DReps vote Yes by then, it fails
            automatically.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function TreasuryTierBadge({ tier }: { tier: string }) {
  const labels: Record<string, string> = {
    routine: '< 1M ADA',
    significant: '1M – 20M ADA',
    major: '> 20M ADA',
  };
  const tooltip = TREASURY_TIER_TOOLTIPS[tier];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-[10px] cursor-help">
            {labels[tier] || tier}
          </Badge>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent side="bottom" className="max-w-[240px]">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

export function TypeExplainerTooltip({ proposalType }: { proposalType: string }) {
  const explainer = TYPE_EXPLAINERS[proposalType];
  if (!explainer) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help text-muted-foreground hover:text-foreground transition-colors text-xs">
            ⓘ
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px]">
          <p className="text-xs">{explainer}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { getProposalStatus, getProposalPriority, STATUS_STYLES, PRIORITY_STYLES };
export type { ProposalStatus, ProposalPriority };
