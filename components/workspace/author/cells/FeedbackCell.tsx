'use client';

import { MessageSquare } from 'lucide-react';

export function FeedbackCell({ count }: { count: number | null }) {
  if (count === null || count === 0) {
    return <span className="text-xs text-muted-foreground/40">—</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <MessageSquare className="h-3 w-3" />
      {count}
    </span>
  );
}
