'use client';

import { useEffect, useState } from 'react';

const STALE_WARNING_MINS = 720; // 12 hours
const STALE_CRITICAL_MINS = 1440; // 24 hours
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // re-check every 5 min

interface SyncStatus {
  status: 'healthy' | 'critical' | 'unknown';
  core_syncs?: { type: string; stale: boolean; staleMins: number | null }[];
}

function formatStaleness(mins: number): string {
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

export function SyncFreshnessBanner() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const res = await fetch('/api/health/sync');
        if (mounted) {
          const data = await res.json();
          setStatus(data);
        }
      } catch {
        // Silently fail — banner is non-critical
      }
    }

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (dismissed || !status || status.status === 'healthy') return null;

  const staleSyncs = status.core_syncs?.filter((s) => s.stale) ?? [];
  if (staleSyncs.length === 0) return null;

  const maxStaleMins = Math.max(...staleSyncs.map((s) => s.staleMins ?? 0));
  const isCritical = maxStaleMins >= STALE_CRITICAL_MINS;
  const isWarning = maxStaleMins >= STALE_WARNING_MINS;

  if (!isWarning) return null;

  return (
    <div
      role="alert"
      className={`relative z-50 flex items-center justify-between gap-2 px-4 py-2 text-xs ${
        isCritical
          ? 'bg-destructive/10 text-destructive border-b border-destructive/20'
          : 'bg-amber-500/10 text-amber-400 border-b border-amber-500/20'
      }`}
    >
      <span>Governance data may be outdated. Last sync: {formatStaleness(maxStaleMins)} ago.</span>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}
