'use client';

import { cn } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────── */

interface RationaleQuoteProps {
  excerpt: string;
  proposalTitle: string;
  similarity: number; // 0-1
  className?: string;
}

/* ─── Component ─────────────────────────────────────────── */

export function RationaleQuote({
  excerpt,
  proposalTitle,
  similarity,
  className,
}: RationaleQuoteProps) {
  const relevancePercent = Math.round(similarity * 100);

  return (
    <div className={cn('border-l-2 border-primary pl-3 py-1.5', className)}>
      <p className="text-sm italic text-foreground/80">&ldquo;{excerpt}&rdquo;</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">On: {proposalTitle}</span>
        <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
          {relevancePercent}% relevant
        </span>
      </div>
    </div>
  );
}
