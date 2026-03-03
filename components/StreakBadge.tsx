'use client';

import { Flame } from 'lucide-react';
import { useWallet } from '@/utils/wallet';

interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  const { isAuthenticated } = useWallet();

  if (!isAuthenticated || streak <= 1) return null;

  return (
    <span className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs rounded-full px-2 py-0.5 flex items-center gap-1 tabular-nums">
      <Flame className="h-3 w-3" />
      {streak}
    </span>
  );
}
