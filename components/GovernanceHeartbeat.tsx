'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type ActivityLevel = 'quiet' | 'active' | 'busy';

export function GovernanceHeartbeat() {
  const [level, setLevel] = useState<ActivityLevel>('quiet');
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/api/governance/activity?limit=5');
        if (!res.ok) return;
        const events = await res.json();
        const recentCount = Array.isArray(events) ? events.length : 0;
        setCount(recentCount);

        if (recentCount >= 10) setLevel('busy');
        else if (recentCount >= 3) setLevel('active');
        else setLevel('quiet');
      } catch {}
    }

    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  const colors: Record<ActivityLevel, string> = {
    quiet: 'bg-muted-foreground/30',
    active: 'bg-cyan-400',
    busy: 'bg-emerald-400',
  };

  const labels: Record<ActivityLevel, string> = {
    quiet: 'Governance is quiet right now',
    active: `${count} recent governance actions`,
    busy: `${count} governance actions — governance is active!`,
  };

  const animationClass = level === 'quiet' ? '' : 'animate-pulse';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/governance/health"
            className="relative flex items-center justify-center w-5 h-5"
            aria-label={labels[level]}
          >
            <span
              className={`absolute inline-flex h-2.5 w-2.5 rounded-full ${colors[level]} ${animationClass}`}
            />
            {level !== 'quiet' && (
              <span
                className={`absolute inline-flex h-2.5 w-2.5 rounded-full ${colors[level]} opacity-30 animate-ping`}
              />
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{labels[level]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
