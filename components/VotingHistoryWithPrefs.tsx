'use client';

import { useEffect, useState } from 'react';
import { VoteRecord, UserPrefKey } from '@/types/drep';
import { getUserPrefs } from '@/utils/userPrefs';
import dynamic from 'next/dynamic';

const VotingHistoryChart = dynamic(
  () => import('@/components/VotingHistoryChart').then((m) => m.VotingHistoryChart),
  { ssr: false },
);

interface VotingHistoryWithPrefsProps {
  votes: VoteRecord[];
}

export function VotingHistoryWithPrefs({ votes }: VotingHistoryWithPrefsProps) {
  const [userPrefs, setUserPrefs] = useState<UserPrefKey[]>([]);

  useEffect(() => {
    const prefs = getUserPrefs();
    if (prefs?.userPrefs) {
      setUserPrefs(prefs.userPrefs);
    }
  }, []);

  return <VotingHistoryChart votes={votes} userPrefs={userPrefs} />;
}
