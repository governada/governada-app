'use client';

import { useState } from 'react';
import { Shield, CheckCircle2, BarChart3, Users, Swords, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SPOClaimHero({
  poolId,
  poolName,
  summary,
}: {
  poolId: string;
  poolName: string;
  summary: any;
}) {
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spoScore: number = summary?.spoScore ?? summary?.score ?? 0;
  const voteCount: number = summary?.voteCount ?? 0;

  async function handleClaim() {
    setClaiming(true);
    setError(null);
    try {
      const res = await fetch('/api/spo/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Claim failed');
      }
      setClaimed(true);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setClaiming(false);
    }
  }

  if (claimed) {
    return (
      <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/20 p-8 text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        </div>
        <div>
          <p className="text-xl font-bold text-emerald-300">Pool Claimed!</p>
          <p className="text-sm text-muted-foreground mt-1">
            {poolName} is now yours. Set up your governance profile to attract staking delegators.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Open your dashboard <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-8 text-center space-y-5">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">This pool is yours.</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Claim <span className="font-medium text-foreground">{poolName}</span> to build your
            governance reputation and unlock your SPO command center.
          </p>
        </div>

        {/* Current metrics preview */}
        {(spoScore > 0 || voteCount > 0) && (
          <div className="flex justify-center gap-6 text-center">
            {spoScore > 0 && (
              <div>
                <p className="font-display text-2xl font-bold tabular-nums text-primary">
                  {spoScore.toFixed(1)}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase">Score</p>
              </div>
            )}
            {voteCount > 0 && (
              <div>
                <p className="font-display text-2xl font-bold tabular-nums text-foreground">
                  {voteCount}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase">Votes</p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleClaim}
          disabled={claiming}
          className={cn(
            'inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            claiming && 'opacity-60 cursor-wait',
          )}
        >
          <Shield className="h-4 w-4" />
          {claiming ? 'Verifying ownership…' : 'Claim This Pool'}
        </button>

        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>

      {/* Value propositions */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          {
            icon: BarChart3,
            title: 'Governance Score',
            desc: 'Track your 4-pillar governance score and see how you rank among SPOs.',
          },
          {
            icon: Shield,
            title: 'Alignment Radar',
            desc: 'Visualize your governance alignment across 6 dimensions.',
          },
          {
            icon: Users,
            title: 'Delegator Insights',
            desc: 'See delegator trends and how your governance participation attracts stake.',
          },
          {
            icon: Swords,
            title: 'Competitive Standing',
            desc: 'Compare your governance reputation against nearby SPOs in your size tier.',
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <Icon className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
