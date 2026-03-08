'use client';
/* eslint-disable react-hooks/set-state-in-effect -- async/external state sync in useEffect is standard React pattern */
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
