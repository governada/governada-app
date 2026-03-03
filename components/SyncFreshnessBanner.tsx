'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'critical' | 'error' | 'unknown';
}

export function SyncFreshnessBanner() {
  const [status, setStatus] = useState<HealthResponse['status'] | null>(null);

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (!res.ok) return;
        const data: HealthResponse = await res.json();
        if (mounted && (data.status === 'degraded' || data.status === 'critical')) {
          setStatus(data.status);
        }
      } catch {
        /* best-effort */
      }
    }

    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!status) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-sm text-amber-700 dark:text-amber-400 flex items-center justify-center gap-2">
      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
      <span>
        {status === 'critical'
          ? 'Governance data is currently delayed. We are working on it.'
          : 'Some data may be slightly delayed. Refreshing shortly.'}
      </span>
    </div>
  );
}
