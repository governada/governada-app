'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Users, Compass, Activity, Vote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConstellationScene } from '@/components/ConstellationScene';
import { trackFunnel, FUNNEL_EVENTS } from '@/lib/funnel';

interface AnonymousLandingProps {
  pulseData?: {
    totalAdaGoverned: string;
    activeProposals: number;
    activeDReps: number;
    activeSpOs: number;
    totalDelegators: number;
  };
}

/**
 * Anonymous Landing — Optimized conversion page.
 *
 * Two clear paths:
 * 1. "Build your governance team" → /match (the conversion action)
 * 2. "Explore governance" → /governance (browse without connecting)
 *
 * Enhanced social proof: live DRep, proposal, and participation counts.
 * Glass-window peek at governance health pulse to demonstrate value.
 * PostHog funnel instrumented at every interaction.
 */
export function AnonymousLanding({ pulseData }: AnonymousLandingProps) {
  useEffect(() => {
    trackFunnel(FUNNEL_EVENTS.LANDING_VIEWED);
  }, []);

  return (
    <div className="relative flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Constellation hero */}
      <section className="relative flex-1 min-h-[50vh] sm:-mt-14 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0">
          <ConstellationScene className="w-full h-full" interactive={false} />
        </div>

        {/* Gradient fade */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        {/* Hero content */}
        <div className="relative z-10 text-center max-w-lg px-6 sm:pt-14">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight hero-text-shadow">
            Your ADA gives you
            <br />
            <span className="text-primary">a voice.</span>
          </h1>
          <p
            className="mt-4 text-lg sm:text-xl text-white/90 font-medium"
            style={{
              textShadow: '0 2px 12px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)',
            }}
          >
            Build your governance team in 60 seconds.
          </p>
        </div>
      </section>

      {/* CTAs + social proof */}
      <section className="relative z-10 mx-auto w-full max-w-lg px-6 -mt-8 pb-12 space-y-6">
        {/* Primary CTA — Build your governance team */}
        <div className="flex flex-col gap-3">
          <Button
            asChild
            size="lg"
            className="w-full gap-2 text-base py-6 rounded-xl font-semibold"
            onClick={() => trackFunnel(FUNNEL_EVENTS.MATCH_STARTED, { source: 'landing_primary' })}
          >
            <Link href="/match">
              <Users className="h-5 w-5" />
              Build Your Governance Team
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full gap-2"
            onClick={() =>
              trackFunnel(FUNNEL_EVENTS.EXPLORE_CLICKED, { source: 'landing_secondary' })
            }
          >
            <Link href="/governance">
              <Compass className="h-4 w-4" />
              Explore Governance
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Live social proof stats */}
        {pulseData && (
          <div className="rounded-xl border border-white/[0.08] bg-card/15 backdrop-blur-md p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <SocialProofStat
                icon={Users}
                value={pulseData.activeDReps}
                label="active DReps representing you"
              />
              <SocialProofStat
                icon={Vote}
                value={pulseData.activeProposals}
                label="proposals being decided"
              />
              <SocialProofStat
                icon={Activity}
                value={pulseData.totalDelegators}
                label="citizens participating"
              />
            </div>
          </div>
        )}

        {/* Secondary discovery links */}
        <div className="flex items-center justify-center gap-4 text-xs">
          <Link
            href="/governance/health"
            className="text-muted-foreground/70 hover:text-primary transition-colors"
            onClick={() => trackFunnel(FUNNEL_EVENTS.EXPLORE_CLICKED, { source: 'landing_health' })}
          >
            Is governance healthy? &rarr;
          </Link>
          <span className="text-border">|</span>
          <Link
            href="/governance/proposals"
            className="text-muted-foreground/70 hover:text-primary transition-colors"
            onClick={() =>
              trackFunnel(FUNNEL_EVENTS.EXPLORE_CLICKED, { source: 'landing_proposals' })
            }
          >
            What&apos;s being voted on? &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ─── Social proof stat ───────────────────────────────── */

function SocialProofStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Users;
  value: number;
  label: string;
}) {
  const formatted = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-primary/70" />
        <span className="text-lg font-bold text-foreground tabular-nums">{formatted}</span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}
