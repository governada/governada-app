'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface AdvisorTeaserProps {
  className?: string;
}

export function AdvisorTeaser({ className }: AdvisorTeaserProps) {
  const { segment } = useSegment();

  if (segment !== 'anonymous') return null;

  return (
    <div className={cn('w-full', className)}>
      <Link href="/match" className="group block">
        <div className="relative rounded-xl border border-border/50 bg-card/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            <span className="flex-1 text-sm text-muted-foreground/60">
              Ask Seneca any governance question...
            </span>
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground/40" />
          </div>
        </div>
      </Link>
      <p className="mt-1.5 text-center text-xs text-muted-foreground/60">
        Connect your wallet to unlock Seneca, your governance advisor
      </p>
    </div>
  );
}
