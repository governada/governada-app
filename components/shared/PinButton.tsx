'use client';

import { Pin, PinOff } from 'lucide-react';
import { usePinnedItems, type PinnedEntityType } from '@/hooks/usePinnedItems';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PinButtonProps {
  type: PinnedEntityType;
  id: string;
  label: string;
}

/**
 * Pin/unpin toggle for entity pages.
 * Pinned entities appear in the sidebar's Pinned section.
 */
export function PinButton({ type, id, label }: PinButtonProps) {
  const { isPinned, pin, unpin } = usePinnedItems();
  const pinned = isPinned(type, id);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => (pinned ? unpin(type, id) : pin(type, id, label))}
          aria-label={pinned ? 'Unpin from sidebar' : 'Pin to sidebar'}
        >
          {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{pinned ? 'Unpin from sidebar' : 'Pin to sidebar'}</p>
      </TooltipContent>
    </Tooltip>
  );
}
