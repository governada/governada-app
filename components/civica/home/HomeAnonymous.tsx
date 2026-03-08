'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Users,
  ShieldCheck,
  Activity,
  Zap,
  Vote,
  HelpCircle,
  Coins,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { posthog } from '@/lib/posthog';
import { ConstellationScene } from '@/components/ConstellationScene';

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

export function HomeAnonymous({ pulseData }: HomeAnonymousProps) {
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* ── Constellation hero ─────────────────────────────────────── */}
      <section
        className="relative h-[55vh] sm:h-[calc(55vh+3.5rem)] min-h-[420px] sm:-mt-14 overflow-hidden"
        aria-label="Governance constellation visualization"
      >
        <div className="absolute inset-0">
          <ConstellationScene className="w-full h-full" interactive={false} />
        </div>

        {/* Gradient fade at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        {/* Live data overlay on constellation */}
        <div className="absolute top-16 sm:top-20 left-4 right-4 flex justify-center pointer-events-none">
          <div className="flex items-center gap-3 sm:gap-6 text-white/60 text-[10px] sm:text-xs tracking-wider uppercase">
            <span className="tabular-nums">
              <strong className="text-white/90">{pulseData.activeDReps}</strong> DReps
            </span>
            <span className="text-white/30">&middot;</span>
            <span className="tabular-nums">
              <strong className="text-white/90">{pulseData.activeSpOs}</strong> SPOs
            </span>
            <span className="text-white/30">&middot;</span>
            <span className="tabular-nums">
              <strong className="text-white/90">{pulseData.ccMembers}</strong> CC Members
            </span>
          </div>
        </div>

        {/* Value prop overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 sm:pt-14">
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white drop-shadow-lg leading-tight text-center">
            Your ADA gives you a voice.
          </h1>

          {/* Gap where the constellation core sun shows through */}
          <div className="h-10 sm:h-16" />

          <p className="font-display text-xl sm:text-2xl lg:text-3xl font-semibold text-[#fff0d4] drop-shadow-lg text-center">
            It takes 60 seconds to use it.
          </p>

          {/* Live urgency hook */}
          {pulseData.activeProposals > 0 && (
            <p
              className="text-sm sm:text-base text-white/70 mt-4 text-center tabular-nums"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}
            >
              <strong className="text-white/90">{pulseData.activeProposals} proposals</strong> are
              being decided right now.{' '}
              <strong className="text-[#fff0d4]">&#x20B3;{pulseData.totalAdaGoverned}</strong> is at
              stake.
            </p>
          )}
        </div>
      </section>

      {/* ── Two-Path Entry ─────────────────────────────────────────── */}
      <section className="relative z-10 -mt-10 px-4 mx-auto w-full max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Path 1: Govern — Quick Match */}
          <Link
            href="/match"
            onClick={() => posthog?.capture('citizen_path_clicked', { path: 'govern' })}
            className={cn(
              'group relative rounded-xl border border-primary/30 bg-card/80 backdrop-blur-sm p-6',
              'hover:border-primary/60 hover:bg-card/90 transition-all',
            )}
          >
            <div className="absolute -inset-0.5 rounded-xl bg-primary/10 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative space-y-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Govern</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Find a DRep who votes the way you would. 3 questions, 60 seconds, matched to{' '}
                {pulseData.activeDReps}+ representatives.
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                Find My DRep
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>

          {/* Path 2: Stake — Pool Discovery */}
          <Link
            href="/discover?tab=pools"
            onClick={() => posthog?.capture('citizen_path_clicked', { path: 'stake' })}
            className={cn(
              'group relative rounded-xl border border-border bg-card/80 backdrop-blur-sm p-6',
              'hover:border-primary/40 hover:bg-card/90 transition-all',
            )}
          >
            <div className="relative space-y-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-500/10 p-2">
                  <Coins className="h-5 w-5 text-emerald-500" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Stake</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Find a stake pool that represents your values. Compare governance scores, voting
                records, and community alignment.
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                Browse Pools
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* ── What is governance? ────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-2xl px-4 mt-8">
        <div className="rounded-xl border border-border/50 bg-muted/20 px-5 py-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-4 w-4 text-primary/60 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">Why does this matter?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cardano has a ratified constitution, a treasury worth billions of ADA, and elected
                representatives. Protocol changes, treasury spending, and staking rewards are all
                decided by governance votes. Every ADA holder has a voice &mdash; you just need to
                use it.
              </p>
              <Link href="/learn" className="text-xs text-primary hover:underline inline-block">
                Learn more about Cardano governance &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live governance stats ──────────────────────────────────── */}
      <section className="mx-auto w-full max-w-4xl px-4 mt-8 mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              icon: Vote,
              label: 'Open Proposals',
              value: pulseData.activeProposals,
              sub: 'awaiting votes',
            },
            {
              icon: Users,
              label: 'Active DReps',
              value: pulseData.activeDReps,
              sub: 'voting right now',
            },
            {
              icon: ShieldCheck,
              label: 'SPOs Governing',
              value: pulseData.activeSpOs,
              sub: 'pools participating',
            },
            {
              icon: Activity,
              label: 'Votes This Week',
              value: pulseData.votesThisWeek.toLocaleString(),
              sub: 'across all bodies',
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4 space-y-1"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <s.icon className="h-3.5 w-3.5 text-primary/50" />
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {s.label}
                </p>
              </div>
              <p className="font-display text-2xl font-bold text-foreground tabular-nums">
                {s.value}
              </p>
              <p className="text-[10px] text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Social proof strip ──────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-4xl px-4 pb-16">
        <div className="rounded-xl border border-border/50 bg-muted/30 px-6 py-4 space-y-2">
          <p className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Citizens are already shaping Cardano&apos;s future
          </p>
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
