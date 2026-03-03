'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { DRepTableClient } from '@/components/DRepTableClient';
import { FeatureGate } from '@/components/FeatureGate';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { EnrichedDRep } from '@/lib/koios';
import { GovernanceIdentityCard } from '@/components/matching/GovernanceIdentityCard';

const GovernanceWidget = dynamic(
  () => import('@/components/GovernanceWidget').then((m) => m.GovernanceWidget),
  { ssr: false },
);
const GovernanceDNAQuiz = dynamic(
  () => import('@/components/GovernanceDNAQuiz').then((m) => m.GovernanceDNAQuiz),
  { ssr: false },
);

const WATCHLIST_KEY = 'drepscore_watchlist';

function getLocalWatchlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalWatchlist(watchlist: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
}

interface HomepageShellProps {
  initialDReps?: EnrichedDRep[];
  initialAllDReps?: EnrichedDRep[];
  initialTotalAvailable?: number;
}

export function HomepageShell({
  initialDReps,
  initialAllDReps,
  initialTotalAvailable,
}: HomepageShellProps = {}) {
  const { isAuthenticated, sessionAddress } = useWallet();
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [matchData, setMatchData] = useState<Record<string, number>>({});
  const [matchConfidence, setMatchConfidence] = useState<Record<string, number>>({});
  const [userProfile, setUserProfile] = useState<{
    personalityLabel: string | null;
    votesUsed: number;
    confidence: number;
    alignmentScores: Record<string, number | null> | null;
  } | null>(null);

  useEffect(() => {
    setWatchlist(getLocalWatchlist());
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !sessionAddress) return;

    const token = getStoredSession();
    if (!token) return;

    // Fetch user data (watchlist)
    fetch('/api/user', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.watchlist?.length > 0) {
          setWatchlist(data.watchlist);
          saveLocalWatchlist(data.watchlist);
        }
      })
      .catch(console.error);

    // Auto-fetch Governance DNA matches for users with existing poll votes
    fetch('/api/governance/matches', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.matches?.length > 0) {
          const scoreMap: Record<string, number> = {};
          const confMap: Record<string, number> = {};
          for (const m of data.matches) {
            scoreMap[m.drepId] = m.matchScore;
            if (m.confidence != null) confMap[m.drepId] = m.confidence;
          }
          setMatchData(scoreMap);
          setMatchConfidence(confMap);
        }
      })
      .catch(console.error);

    // Fetch user governance profile for identity card
    fetch('/api/governance/my-profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.votesUsed > 0) {
          setUserProfile({
            personalityLabel: data.personalityLabel,
            votesUsed: data.votesUsed,
            confidence: data.confidence,
            alignmentScores: data.alignmentScores,
          });
        }
      })
      .catch(console.error);
  }, [isAuthenticated, sessionAddress]);

  const handleWatchlistToggle = useCallback(
    async (drepId: string) => {
      const newWatchlist = watchlist.includes(drepId)
        ? watchlist.filter((id) => id !== drepId)
        : [...watchlist, drepId];

      setWatchlist(newWatchlist);
      saveLocalWatchlist(newWatchlist);

      if (isAuthenticated) {
        const token = getStoredSession();
        if (token) {
          fetch('/api/user', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ watchlist: newWatchlist }),
          }).catch(console.error);
        }
      }
    },
    [watchlist, isAuthenticated],
  );

  return (
    <div className="space-y-6">
      <GovernanceWidget />

      {userProfile && (
        <GovernanceIdentityCard
          personalityLabel={userProfile.personalityLabel}
          votesUsed={userProfile.votesUsed}
          confidence={userProfile.confidence}
          alignmentScores={userProfile.alignmentScores}
        />
      )}

      <FeatureGate flag="governance_dna_quiz">
        <GovernanceDNAQuiz onQuizComplete={setMatchData} />
      </FeatureGate>

      <div id="drep-table" />
      <DRepTableClient
        initialDReps={initialDReps}
        initialAllDReps={initialAllDReps}
        initialTotalAvailable={initialTotalAvailable}
        watchlist={watchlist}
        onWatchlistToggle={handleWatchlistToggle}
        isConnected={isAuthenticated}
        matchData={matchData}
        matchConfidence={matchConfidence}
      />
    </div>
  );
}
