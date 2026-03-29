'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { DecisionTableItem } from '@/lib/workspace/types';

export function ProposalCell({ item }: { item: DecisionTableItem }) {
  const needsTooltip = item.title.length > 50;

  const titleEl = (
    <span className="truncate max-w-[200px] lg:max-w-[300px] inline-block align-bottom">
      {item.title}
    </span>
  );

  if (needsTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{titleEl}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {item.title}
        </TooltipContent>
      </Tooltip>
    );
  }

  return titleEl;
}
