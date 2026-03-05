'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight, Users, ShieldCheck, Activity, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GovTerm } from '@/components/GovTerm';

const GovernanceConstellation = dynamic(
  () =>
    import('@/components/GovernanceConstellation').then((m) => ({
      default: m.GovernanceConstellation,
    })),
  { ssr: false },
);

interface PulseData {
  totalAdaGoverned: string;
  activeProposals: number;
  activeDReps: number;
  totalDReps: number;
  votesThisWeek: number;
  claimedDReps: number;
  activeSpOs: number;
  ccMembers: number;
}

interface HomeAnonymousProps {
  pulseData: PulseData;
}

interface StatItem {
  label: string;
  value: string | number;
  sub?: string;
}

export function HomeAnonymous({ pulseData }: HomeAnonymousProps) {
  const [matchExpanded, setMatchExpanded] = useState(false);

  const stats: StatItem[] = [
    {
      label: 'ADA Governed',
      value: `₳${pulseData.totalAdaGoverned}`,
      sub: 'in active delegation',
    },
    { label: 'Active DReps', value: pulseData.activeDReps, sub: 'voting right now' },
    { label: 'Open Proposals', value: pulseData.activeProposals, sub: 'awaiting votes' },
    { label: 'SPOs Participating', value: pulseData.activeSpOs, sub: 'in governance' },
  ];

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* ── Constellation hero (75vh) ────────────────────────────────── */}
      <section className="relative h-[60vh] min-h-[480px] overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0">
          <GovernanceConstellation className="w-full h-full" interactive={false} />
        </div>

        {/* Gradient fade at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        {/* Value prop overlay */}
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className="text-center max-w-2xl space-y-4">
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white drop-shadow-lg leading-tight">
              Cardano has a government.
              <br />
              <span className="text-primary">Know who represents you.</span>
            </h1>
            <p className="text-base sm:text-lg text-white/80 max-w-lg mx-auto leading-relaxed">
              Every ADA holder has a voice in <GovTerm term="governanceAction">governance</GovTerm>.
              Find the <GovTerm term="drep">DRep</GovTerm> who shares your values — in under 2
              minutes.
            </p>
          </div>
        </div>
      </section>

      {/* ── Quick Match CTA ──────────────────────────────────────────── */}
      <section className="relative z-10 -mt-12 px-4 flex flex-col items-center gap-4">
        {/* Glowing primary CTA */}
        <div className="relative group">
          <div
            className={cn(
              'absolute -inset-1 rounded-xl bg-primary/40 blur-md',
              'animate-pulse group-hover:bg-primary/60 transition-colors',
            )}
            aria-hidden
          />
          <Button
            size="lg"
            className="relative text-base px-8 py-6 rounded-xl font-semibold shadow-lg"
            onClick={() => setMatchExpanded((v) => !v)}
            aria-expanded={matchExpanded}
            aria-controls="quick-match-panel"
          >
            <Zap className="mr-2 h-5 w-5" />
            Find My DRep
            <ArrowRight
              className={cn(
                'ml-2 h-4 w-4 transition-transform duration-200',
                matchExpanded && 'rotate-90',
              )}
            />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          No wallet required to explore · Connect to delegate
        </p>
      </section>

      {/* Quick Match inline expansion (desktop) / bottom-sheet stub (mobile) */}
      {matchExpanded && (
        <section
          id="quick-match-panel"
          className="mx-auto w-full max-w-2xl px-4 mt-6 animate-in slide-in-from-top-2 duration-200"
        >
          <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-6 space-y-4">
            <p className="text-sm font-medium text-foreground">
              Answer 5 quick questions about governance priorities — we'll match you to DReps who
              vote like you think.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="flex-1">
                <Link href="/match">
                  Take the Quick Match quiz
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href="/discover">Browse all DReps</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ── Live governance stat counters (SSR) ─────────────────────── */}
      <section className="mx-auto w-full max-w-4xl px-4 mt-12 mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4 text-center space-y-1"
            >
              <p className="font-display text-2xl font-bold text-foreground tabular-nums">
                {s.value}
              </p>
              <p className="text-xs font-medium text-foreground/80">{s.label}</p>
              {s.sub && <p className="text-[10px] text-muted-foreground">{s.sub}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ── Social proof strip ───────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-4xl px-4 pb-16">
        <div className="rounded-xl border border-border/50 bg-muted/30 px-6 py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary/60 shrink-0" />
              <strong className="text-foreground">
                {pulseData.totalDReps.toLocaleString()}
              </strong>{' '}
              DReps scored
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary/60 shrink-0" />
              <strong className="text-foreground">{pulseData.claimedDReps}</strong> profiles claimed
            </span>
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary/60 shrink-0" />
              <strong className="text-foreground">
                {pulseData.votesThisWeek.toLocaleString()}
              </strong>{' '}
              votes cast this week
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
