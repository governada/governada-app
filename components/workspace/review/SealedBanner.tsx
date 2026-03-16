'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Shield } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface SealedBannerProps {
  sealedUntil: string;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';

  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

export function SealedBanner({ sealedUntil }: SealedBannerProps) {
  const queryClient = useQueryClient();
  const sealedDate = useMemo(() => new Date(sealedUntil), [sealedUntil]);

  const [remaining, setRemaining] = useState(() => sealedDate.getTime() - Date.now());

  const tick = useCallback(() => {
    const diff = sealedDate.getTime() - Date.now();
    setRemaining(diff);

    if (diff <= 0) {
      // Period expired — refresh the review queue to unseal positions
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    }
  }, [sealedDate, queryClient]);

  useEffect(() => {
    tick();
    const interval = setInterval(tick, 60_000); // Update every minute
    return () => clearInterval(interval);
  }, [tick]);

  if (remaining <= 0) return null;

  const sealedDateFormatted = sealedDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-start gap-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-4">
      <Shield className="mt-0.5 size-5 shrink-0 text-indigo-400" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
          Independent Assessment Period
        </p>
        <p className="text-sm text-muted-foreground">
          Positions are sealed until {sealedDateFormatted}. Form your own opinion before seeing how
          others voted.
        </p>
        <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70">
          {formatTimeRemaining(remaining)}
        </p>
      </div>
    </div>
  );
}
