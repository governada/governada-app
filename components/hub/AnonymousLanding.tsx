'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Users, Compass, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { trackFunnel, FUNNEL_EVENTS } from '@/lib/funnel';

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false, loading: () => <div className="w-full h-full bg-background" /> },
);

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
            Choose who votes for you. It takes 60 seconds.
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
              Choose Your Representative
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
              See What&apos;s Happening
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="w-full gap-2 text-muted-foreground hover:text-primary"
            onClick={() =>
              trackFunnel(FUNNEL_EVENTS.EXPLORE_CLICKED, { source: 'landing_get_started' })
            }
          >
            <Link href="/get-started">
              <Rocket className="h-4 w-4" />
              New to Cardano Governance? Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Narrative social proof — frames raw numbers as personal stakes */}
        {pulseData && pulseData.activeProposals > 0 && (
          <div className="rounded-xl border border-white/[0.08] bg-card/15 backdrop-blur-md p-4">
            <p className="text-sm text-muted-foreground leading-relaxed text-center">
              Right now,{' '}
              <strong className="text-foreground">{pulseData.activeProposals} proposals</strong> are
              deciding how Cardano&apos;s treasury is spent.{' '}
              <strong className="text-foreground">{pulseData.activeDReps} representatives</strong>{' '}
              are voting on your behalf. Your ADA gives you a say.
            </p>
          </div>
        )}

        {/* Secondary discovery links */}
        <div className="flex items-center justify-center gap-4 text-xs">
          <Link
            href="/governance/health"
            className="text-muted-foreground/70 hover:text-primary transition-colors"
            onClick={() => trackFunnel(FUNNEL_EVENTS.EXPLORE_CLICKED, { source: 'landing_health' })}
          >
            How is Cardano being managed? &rarr;
          </Link>
          <span className="text-border">|</span>
          <Link
            href="/governance/proposals"
            className="text-muted-foreground/70 hover:text-primary transition-colors"
            onClick={() =>
              trackFunnel(FUNNEL_EVENTS.EXPLORE_CLICKED, { source: 'landing_proposals' })
            }
          >
            What decisions are being made? &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
