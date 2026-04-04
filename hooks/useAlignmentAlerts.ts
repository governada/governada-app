'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useWallet } from '@/utils/wallet';
import { EnrichedDRep } from '@/lib/koios';
import {
  STORAGE_KEYS,
  readStoredJson,
  readStoredValue,
  writeStoredValue,
} from '@/lib/persistence';

// ── Types ───────────────────────────────────────────────────────────────────

export type AlertType =
  | 'representation-shift'
  | 'inactivity'
  | 'new-proposals'
  | 'vote-activity'
  | 'drep-score-change'
  | 'drep-profile-gap'
  | 'drep-missed-epoch'
  | 'drep-pending-proposals'
  | 'drep-urgent-deadline'
  | 'critical-proposal-open'
  | 'drep-missing-votes'
  | 'ncl-threshold-crossed'
  | 'ncl-period-expiring'
  | 'ncl-exceeded-projected'
  | 'drep-treasury-vote';

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  description: string;
  link?: string;
  timestamp: number;
  read: boolean;
  metadata?: Record<string, unknown>;
}

export interface VoteActivityItem {
  voteTxHash: string;
  proposalTxHash: string;
  proposalIndex: number;
  vote: string;
  blockTime: number;
  proposalTitle: string | null;
  proposalType: string | null;
}

// ── LocalStorage keys ───────────────────────────────────────────────────────

const NCL_LAST_THRESHOLD_KEY = 'governada_ncl_last_threshold';

// ── Thresholds ──────────────────────────────────────────────────────────────

const SHIFT_THRESHOLD = 8;

// ── Helpers ─────────────────────────────────────────────────────────────────

function getStoredMatchScores(): Record<string, { score: number; timestamp: number }> {
  return readStoredJson<Record<string, { score: number; timestamp: number }>>(
    STORAGE_KEYS.prevMatchScores,
    {},
  );
}

function storeMatchScores(data: Record<string, { score: number; timestamp: number }>) {
  writeStoredValue(STORAGE_KEYS.prevMatchScores, JSON.stringify(data));
}

function getLastVisit(): number {
  return parseInt(readStoredValue(STORAGE_KEYS.lastVisit) || '0', 10);
}

function setLastVisit(ts: number) {
  writeStoredValue(STORAGE_KEYS.lastVisit, String(ts));
}

function getDismissedAlerts(): Set<string> {
  return new Set(readStoredJson<string[]>(STORAGE_KEYS.dismissedAlerts, []));
}

function persistDismissedAlerts(ids: Set<string>) {
  writeStoredValue(STORAGE_KEYS.dismissedAlerts, JSON.stringify([...ids]));
}

function getWatchlist(): string[] {
  return readStoredJson<string[]>(STORAGE_KEYS.watchlist, []);
}

function getNclLastThreshold(): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(NCL_LAST_THRESHOLD_KEY) || '0', 10);
}

function setNclLastThreshold(threshold: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NCL_LAST_THRESHOLD_KEY, String(threshold));
}

interface NclAlertData {
  utilizationPct: number;
  projectedUtilizationPct: number;
  epochsRemaining: number;
  nclAda: number;
  remainingAda: number;
  status: 'healthy' | 'elevated' | 'critical';
  startEpoch: number;
  endEpoch: number;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useAlignmentAlerts() {
  const { connected, delegatedDrepId, ownDRepId, isAuthenticated } = useWallet();
  const [allDReps, setAllDReps] = useState<EnrichedDRep[]>([]);
  const [matchData, setMatchData] = useState<Record<string, number>>({});
  const [voteActivity, setVoteActivity] = useState<VoteActivityItem[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [newProposalCount, setNewProposalCount] = useState(0);
  const [lastVisitTime, setLastVisitTime] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [ownDRepScore, setOwnDRepScore] = useState<{
    current: number;
    previous: number | null;
    profileCompleteness: number;
  } | null>(null);
  const [inboxData, setInboxData] = useState<{
    pendingCount: number;
    criticalCount: number;
    urgentCount: number;
    potentialGain: number;
  } | null>(null);
  const [govSummary, setGovSummary] = useState<{
    openCount: number;
    criticalOpenCount: number;
    drepVotedCount?: number;
    drepMissingCount?: number;
  } | null>(null);
  const [nclData, setNclData] = useState<NclAlertData | null>(null);

  useEffect(() => {
    setDismissedIds(getDismissedAlerts());
    setLastVisitTime(getLastVisit());
  }, []);

  // Fetch DRep data when connected
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/dreps');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setAllDReps(data.allDReps || []);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connected]);

  // Fetch new proposals since last visit
  useEffect(() => {
    if (!connected || lastVisitTime === 0) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/alignment/new-proposals?since=${lastVisitTime}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setNewProposalCount(data.count || 0);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connected, lastVisitTime]);

  // Fetch recent vote activity for delegated DRep
  useEffect(() => {
    if (!delegatedDrepId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/alignment/recent-votes?drepId=${encodeURIComponent(delegatedDrepId)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setVoteActivity(data.votes || []);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [delegatedDrepId]);

  // Fetch representation match data when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    (async () => {
      try {
        const { getStoredSession } = await import('@/lib/supabaseAuth');
        const token = getStoredSession();
        if (!token) return;
        const res = await fetch('/api/governance/matches', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          const map: Record<string, number> = {};
          for (const m of data.matches || []) {
            map[m.drepId] = m.matchScore;
          }
          setMatchData(map);
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Fetch DRep-specific score data for DRep alerts
  useEffect(() => {
    if (!ownDRepId) return;
    let cancelled = false;

    (async () => {
      try {
        const myDrep = allDReps.find((d) => d.drepId === ownDRepId);
        if (!myDrep) return;

        const historyRes = await fetch(
          `/api/score-history?drepId=${encodeURIComponent(ownDRepId)}`,
        );
        let previousScore: number | null = null;
        if (historyRes.ok) {
          const history = await historyRes.json();
          if (Array.isArray(history) && history.length >= 2) {
            previousScore = history[history.length - 2]?.score ?? null;
          }
        }

        if (!cancelled) {
          setOwnDRepScore({
            current: myDrep.drepScore,
            previous: previousScore,
            profileCompleteness: myDrep.profileCompleteness ?? 0,
          });
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ownDRepId, allDReps]);

  // Fetch inbox data for DRep-specific alerts
  useEffect(() => {
    if (!ownDRepId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/dashboard/inbox?drepId=${encodeURIComponent(ownDRepId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setInboxData({
            pendingCount: data.pendingCount || 0,
            criticalCount: data.criticalCount || 0,
            urgentCount: data.urgentCount || 0,
            potentialGain: data.scoreImpact?.potentialGain || 0,
          });
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ownDRepId]);

  // Fetch NCL data for budget alerts
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/treasury/ncl');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.ncl) {
          setNclData({
            utilizationPct: data.ncl.utilizationPct,
            projectedUtilizationPct: data.ncl.projectedUtilizationPct,
            epochsRemaining: data.ncl.epochsRemaining,
            nclAda: data.ncl.period.nclAda,
            remainingAda: data.ncl.remainingAda,
            status: data.ncl.status,
            startEpoch: data.ncl.period.startEpoch,
            endEpoch: data.ncl.period.endEpoch,
          });
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connected]);

  // Fetch governance summary for ADA holder alerts (delegators)
  useEffect(() => {
    if (!connected || !delegatedDrepId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/governance/summary?drepId=${encodeURIComponent(delegatedDrepId)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setGovSummary({
            openCount: data.openCount || 0,
            criticalOpenCount: data.criticalOpenCount || 0,
            drepVotedCount: data.drepVotedCount,
            drepMissingCount: data.drepMissingCount,
          });
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connected, delegatedDrepId]);

  // Build all alerts
  const alerts: Alert[] = useMemo(() => {
    if (!loaded || !connected) return [];

    const result: Alert[] = [];
    const now = Math.floor(Date.now() / 1000);
    const watchlist = getWatchlist();
    const drepMap = new Map(allDReps.map((d) => [d.drepId, d]));
    const hasMatchData = Object.keys(matchData).length > 0;

    // ── 1. Representation match shift alerts (delegated + watchlist) ─────
    if (hasMatchData) {
      const prevScores = getStoredMatchScores();
      const newScores: Record<string, { score: number; timestamp: number }> = {};
      const drepIdsToCheck = [...(delegatedDrepId ? [delegatedDrepId] : []), ...watchlist];
      const uniqueIds = [...new Set(drepIdsToCheck)];

      for (const id of uniqueIds) {
        const currentMatch = matchData[id];
        if (currentMatch == null) continue;

        newScores[id] = { score: currentMatch, timestamp: now };
        const drep = drepMap.get(id);
        const prev = prevScores[id];
        if (prev) {
          const delta = currentMatch - prev.score;
          if (delta <= -SHIFT_THRESHOLD) {
            const drepName = drep?.name || drep?.ticker || drep?.handle || `${id.slice(0, 12)}...`;
            const isDelegated = id === delegatedDrepId;
            result.push({
              id: `shift-${id}`,
              type: 'representation-shift',
              title: isDelegated
                ? `Your DRep's representation match dropped`
                : `${drepName}'s representation match dropped`,
              description: `Match went from ${prev.score}% to ${currentMatch}% (${delta > 0 ? '+' : ''}${delta} pts) based on recent votes.`,
              link: `/drep/${encodeURIComponent(id)}?tab=scorecard`,
              timestamp: now,
              read: false,
              metadata: { drepId: id, drepName, previousMatch: prev.score, currentMatch, delta },
            });
          }
        }
      }

      storeMatchScores({ ...prevScores, ...newScores });
    }

    // ── 2. DRep inactivity warning ──────────────────────────────────────
    if (delegatedDrepId) {
      const myDrep = drepMap.get(delegatedDrepId);
      if (myDrep?.lastVoteTime != null) {
        const daysSince = Math.floor((now - myDrep.lastVoteTime) / (24 * 60 * 60));
        if (daysSince > 30) {
          result.push({
            id: `inactivity-${delegatedDrepId}`,
            type: 'inactivity',
            title: 'Your DRep has been inactive',
            description: `No votes in the last ${daysSince} days. Consider reviewing their activity.`,
            link: `/drep/${encodeURIComponent(delegatedDrepId)}?tab=votes`,
            timestamp: now,
            read: false,
            metadata: { daysSince },
          });
        }
      }
    }

    // ── 3. New proposals since last visit ────────────────────────────────
    if (newProposalCount > 0) {
      result.push({
        id: `new-proposals-${lastVisitTime}`,
        type: 'new-proposals',
        title: `${newProposalCount} new proposal${newProposalCount !== 1 ? 's' : ''}`,
        description: `${newProposalCount} new governance proposal${newProposalCount !== 1 ? 's' : ''} since your last visit.`,
        link: '/governance/proposals',
        timestamp: now,
        read: false,
      });
    }

    // ── 4. Vote activity summary ────────────────────────────────────────
    for (const v of voteActivity.slice(0, 3)) {
      const title = v.proposalTitle || `Proposal ${v.proposalTxHash.slice(0, 8)}...`;

      result.push({
        id: `vote-${v.voteTxHash}`,
        type: 'vote-activity',
        title: `Your DRep voted ${v.vote}`,
        description: `On "${title}".`,
        link: `/proposal/${v.proposalTxHash}/${v.proposalIndex}`,
        timestamp: v.blockTime,
        read: false,
        metadata: { vote: v.vote },
      });
    }

    // ── 5. DRep-specific alerts (when viewer is a DRep) ─────────────────
    if (ownDRepId && ownDRepScore) {
      // Score change alert
      if (ownDRepScore.previous !== null) {
        const delta = ownDRepScore.current - ownDRepScore.previous;
        if (delta !== 0) {
          result.push({
            id: `drep-score-${ownDRepId}-${now}`,
            type: 'drep-score-change',
            title: delta > 0 ? 'Your DRep Score improved' : 'Your DRep Score dropped',
            description: `Score changed from ${ownDRepScore.previous} to ${ownDRepScore.current} (${delta > 0 ? '+' : ''}${delta} pts) since last snapshot.`,
            link: `/drep/${encodeURIComponent(ownDRepId)}`,
            timestamp: now,
            read: false,
            metadata: { delta, current: ownDRepScore.current, previous: ownDRepScore.previous },
          });
        }
      }

      // Profile gap alert
      if (ownDRepScore.profileCompleteness < 100) {
        result.push({
          id: `drep-profile-${ownDRepId}`,
          type: 'drep-profile-gap',
          title: 'Complete your DRep profile',
          description: `Your Profile Completeness is ${ownDRepScore.profileCompleteness}%. Complete your metadata for an easy score boost.`,
          link: `/drep/${encodeURIComponent(ownDRepId)}`,
          timestamp: now,
          read: false,
          metadata: { profileCompleteness: ownDRepScore.profileCompleteness },
        });
      }
    }

    // ── 6. Inbox alerts (pending proposals, urgent deadlines) ────────
    if (ownDRepId && inboxData) {
      if (inboxData.pendingCount > 0) {
        const hasCritical = inboxData.criticalCount > 0;
        result.push({
          id: `drep-pending-${ownDRepId}-${inboxData.pendingCount}`,
          type: 'drep-pending-proposals',
          title: hasCritical
            ? `${inboxData.criticalCount} critical proposal${inboxData.criticalCount !== 1 ? 's' : ''} need your vote`
            : `${inboxData.pendingCount} proposal${inboxData.pendingCount !== 1 ? 's' : ''} need your vote`,
          description:
            inboxData.potentialGain > 0
              ? `Voting with rationale could boost your score by +${inboxData.potentialGain} pts.`
              : `Open proposals are awaiting your vote.`,
          link: '/my-gov',
          timestamp: now,
          read: false,
          metadata: {
            pendingCount: inboxData.pendingCount,
            criticalCount: inboxData.criticalCount,
          },
        });
      }

      if (inboxData.urgentCount > 0) {
        result.push({
          id: `drep-urgent-${ownDRepId}-${inboxData.urgentCount}`,
          type: 'drep-urgent-deadline',
          title: `${inboxData.urgentCount} proposal${inboxData.urgentCount !== 1 ? 's' : ''} expiring soon`,
          description: `These proposals will expire within 2 epochs. Vote before they close.`,
          link: '/my-gov',
          timestamp: now,
          read: false,
          metadata: { urgentCount: inboxData.urgentCount },
        });
      }
    }

    // ── 7. ADA Holder governance alerts ──────────────────────────────
    if (govSummary && delegatedDrepId) {
      if (govSummary.criticalOpenCount > 0) {
        result.push({
          id: `critical-open-${govSummary.criticalOpenCount}`,
          type: 'critical-proposal-open',
          title: `${govSummary.criticalOpenCount} critical proposal${govSummary.criticalOpenCount !== 1 ? 's' : ''} open`,
          description:
            'A high-impact governance proposal (Hard Fork, No Confidence, or Constitution change) is currently open for voting.',
          link: '/governance/proposals',
          timestamp: now,
          read: false,
          metadata: { criticalCount: govSummary.criticalOpenCount },
        });
      }

      if (govSummary.drepMissingCount != null && govSummary.drepMissingCount > 0) {
        result.push({
          id: `drep-missing-${delegatedDrepId}-${govSummary.drepMissingCount}`,
          type: 'drep-missing-votes',
          title: `Your DRep hasn't voted on ${govSummary.drepMissingCount} proposal${govSummary.drepMissingCount !== 1 ? 's' : ''}`,
          description: `${govSummary.drepMissingCount} of ${govSummary.openCount} open proposals are still awaiting your DRep's vote.`,
          link: `/drep/${encodeURIComponent(delegatedDrepId)}?tab=votes`,
          timestamp: now,
          read: false,
          metadata: { missingCount: govSummary.drepMissingCount, openCount: govSummary.openCount },
        });
      }
    }

    // ── 8. NCL budget alerts ──────────────────────────────────────────
    if (nclData) {
      const NCL_THRESHOLDS = [90, 75, 50] as const;
      const lastThreshold = getNclLastThreshold();

      // A. NCL threshold crossed
      for (const threshold of NCL_THRESHOLDS) {
        if (nclData.utilizationPct >= threshold && lastThreshold < threshold) {
          const formatAda = (ada: number) =>
            ada >= 1_000_000 ? `${(ada / 1_000_000).toFixed(0)}M` : `${(ada / 1_000).toFixed(0)}K`;
          result.push({
            id: `ncl-threshold-${threshold}`,
            type: 'ncl-threshold-crossed',
            title: `Budget utilization reached ${Math.round(nclData.utilizationPct)}%`,
            description: `The treasury has used ₳${formatAda(nclData.nclAda - nclData.remainingAda)} of the ₳${formatAda(nclData.nclAda)} budget limit. ₳${formatAda(nclData.remainingAda)} remains for ${nclData.epochsRemaining} epochs.`,
            link: '/governance/treasury',
            timestamp: now,
            read: false,
            metadata: {
              threshold,
              utilizationPct: nclData.utilizationPct,
              remainingAda: nclData.remainingAda,
            },
          });
          // Record highest crossed threshold
          setNclLastThreshold(threshold);
          break; // Only fire the highest crossed threshold
        }
      }

      // B. NCL period expiring soon
      if (nclData.epochsRemaining > 0 && nclData.epochsRemaining < 15) {
        result.push({
          id: `ncl-expiring-${nclData.endEpoch}`,
          type: 'ncl-period-expiring',
          title: `Budget period ends in ${nclData.epochsRemaining} epochs`,
          description: `The current ₳${nclData.nclAda >= 1_000_000 ? `${(nclData.nclAda / 1_000_000).toFixed(0)}M` : nclData.nclAda.toLocaleString()} spending limit expires at Epoch ${nclData.endEpoch}. A new NCL Info Action will need to pass for the next period.`,
          link: '/governance/treasury',
          timestamp: now,
          read: false,
          metadata: {
            epochsRemaining: nclData.epochsRemaining,
            endEpoch: nclData.endEpoch,
          },
        });
      }

      // C. Pending proposals would exceed NCL (relevant for DReps)
      if (ownDRepId && nclData.projectedUtilizationPct > 100) {
        result.push({
          id: `ncl-exceeded-projected-${nclData.endEpoch}`,
          type: 'ncl-exceeded-projected',
          title: 'Pending proposals exceed budget limit',
          description: `If all pending proposals pass, total withdrawals would reach ${Math.round(nclData.projectedUtilizationPct)}% of the ₳${nclData.nclAda >= 1_000_000 ? `${(nclData.nclAda / 1_000_000).toFixed(0)}M` : nclData.nclAda.toLocaleString()} constitutional limit.`,
          link: '/governance/treasury',
          timestamp: now,
          read: false,
          metadata: {
            projectedUtilizationPct: nclData.projectedUtilizationPct,
            nclAda: nclData.nclAda,
          },
        });
      }
    }

    // ── 9. DRep treasury vote alert (citizen only) ─────────────────────
    if (delegatedDrepId && voteActivity.length > 0) {
      for (const v of voteActivity.slice(0, 3)) {
        if (v.proposalType === 'TreasuryWithdrawals') {
          result.push({
            id: `drep-treasury-vote-${v.voteTxHash}`,
            type: 'drep-treasury-vote',
            title: `Your DRep voted ${v.vote} on a treasury withdrawal`,
            description: `"${v.proposalTitle || `Proposal ${v.proposalTxHash.slice(0, 8)}...`}" — a treasury withdrawal proposal.`,
            link: `/proposal/${v.proposalTxHash}/${v.proposalIndex}`,
            timestamp: v.blockTime,
            read: false,
            metadata: { vote: v.vote, proposalType: v.proposalType },
          });
        }
      }
    }

    // Update last visit time
    setLastVisit(now);

    return result;
  }, [
    loaded,
    connected,
    matchData,
    allDReps,
    delegatedDrepId,
    ownDRepId,
    ownDRepScore,
    voteActivity,
    lastVisitTime,
    newProposalCount,
    inboxData,
    govSummary,
    nclData,
  ]);

  // Filter out dismissed alerts
  const activeAlerts = useMemo(
    () => alerts.filter((a) => !dismissedIds.has(a.id)),
    [alerts, dismissedIds],
  );

  const dismissAlert = useCallback((alertId: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      persistDismissedAlerts(next);
      return next;
    });
  }, []);

  const unreadCount = activeAlerts.filter((a) => !a.read).length;

  return {
    alerts: activeAlerts,
    unreadCount,
    dismissAlert,
    loaded,
  };
}
