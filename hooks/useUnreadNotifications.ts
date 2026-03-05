'use client';
import { useState, useEffect } from 'react';

export function useUnreadNotifications(stakeAddress: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!stakeAddress) return;
    // Phase 3E scaffold — real implementation queries the notifications table
    setCount(0);
  }, [stakeAddress]);

  return count;
}
