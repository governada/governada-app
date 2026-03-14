'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, Clock, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import type { DeliveryStatus } from '@/lib/proposalOutcomes';

interface Props {
  status: DeliveryStatus;
  score?: number | null;
  compact?: boolean;
}

const STATUS_CONFIG: Record<
  DeliveryStatus,
  { label: string; icon: typeof CheckCircle2; className: string; tooltip: string }
> = {
  delivered: {
    label: 'Delivered',
    icon: CheckCircle2,
    className: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/40',
    tooltip: 'Community confirmed delivery of this proposal',
  },
  partial: {
    label: 'Partial',
    icon: AlertTriangle,
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40',
    tooltip: 'Partial delivery — some deliverables completed',
  },
  not_delivered: {
    label: 'Not Delivered',
    icon: XCircle,
    className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/40',
    tooltip: 'Community reports this proposal has not delivered',
  },
  in_progress: {
    label: 'In Progress',
    icon: Clock,
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40',
    tooltip: 'Enacted and awaiting delivery assessment',
  },
  unknown: {
    label: 'Unknown',
    icon: HelpCircle,
    className: 'bg-muted text-muted-foreground border-border',
    tooltip: 'No community assessment available yet',
  },
};

export function ProposalDeliveryBadge({ status, score, compact }: Props) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const badge = (
    <Badge
      variant="outline"
      className={`gap-1 ${config.className} ${compact ? 'text-[10px] px-1.5 py-0' : 'text-xs'}`}
    >
      <Icon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {config.label}
      {score != null && !compact && <span className="ml-0.5 font-mono tabular-nums">{score}</span>}
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p>{config.tooltip}</p>
          {score != null && (
            <p className="text-xs text-muted-foreground">Delivery score: {score}/100</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
