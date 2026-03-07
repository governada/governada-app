'use client';

import Link from 'next/link';
import { Zap, ArrowRight, Vote, BarChart3, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GovTerm } from '@/components/GovTerm';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet';
import { ConstellationScene } from '@/components/ConstellationScene';
import { EpochBriefing } from './EpochBriefing';
import { CivicIdentityCard } from '@/components/civica/shared/CivicIdentityCard';
import { TreasuryCitizenView } from './TreasuryCitizenView';

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

interface HomeCitizenProps {
  pulseData: PulseData;
  ssrHolderData?: any;
  ssrWalletAddress?: string | null;
}

/* ── Undelegated citizen: wallet connected but no DRep ──────────── */

function UndelegatedHome({ pulseData }: { pulseData: PulseData }) {
  const stats = [
    { label: 'ADA Governed', value: `₳${pulseData.totalAdaGoverned}`, sub: 'without your voice' },
    { label: 'Active DReps', value: pulseData.activeDReps, sub: 'ready to represent you' },
    { label: 'Open Proposals', value: pulseData.activeProposals, sub: 'being voted on now' },
    { label: 'Votes This Week', value: pulseData.votesThisWeek, sub: 'and counting' },
  ];

  return (
    <div className="relative flex flex-col">
      {/* Constellation hero */}
      <section className="relative h-[35vh] min-h-[280px] sm:-mt-14 overflow-hidden">
        <div className="absolute inset-0">
          <ConstellationScene className="w-full h-full" interactive={false} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        <div className="absolute inset-0 flex items-center justify-center px-4 sm:pt-14">
          <div className="text-center max-w-xl space-y-3">
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white drop-shadow-lg leading-tight hero-text-shadow">
              Your ADA is <span className="text-primary">unrepresented</span>.
            </h1>
            <p
              className="text-sm sm:text-base text-white/80 max-w-md mx-auto leading-relaxed hero-text-shadow"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)' }}
            >
              {pulseData.activeProposals > 0 ? (
                <>
                  {pulseData.activeProposals} proposals are being voted on right now — and your
                  voice isn&apos;t counted.
                </>
              ) : (
                <>
                  Governance is happening every epoch — delegate to a{' '}
                  <GovTerm term="drep">DRep</GovTerm> so your ADA has a say.
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Delegation action card */}
      <section className="mx-auto w-full max-w-2xl px-4 -mt-4 relative z-10">
        <div className="rounded-2xl border border-primary/30 bg-primary/5 backdrop-blur-sm p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              Find the <GovTerm term="drep">DRep</GovTerm> who thinks like you
            </h2>
            <p className="text-sm text-muted-foreground">
              Answer 3 quick questions and we&apos;ll match you to DReps who share your governance
              priorities — or browse and compare them yourself.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild size="lg" className="flex-1">
              <Link href="/match">
                <Zap className="mr-2 h-4 w-4" />
                Find My DRep — 60 Seconds
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1">
              <Link href="/discover">Browse all DReps</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Governance pulse stats */}
      <section className="mx-auto w-full max-w-2xl px-4 mt-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-3 text-center space-y-0.5"
            >
              <p className="font-display text-xl font-bold text-foreground tabular-nums">
                {s.value}
              </p>
              <p className="text-xs font-medium text-foreground/80">{s.label}</p>
              <p className="text-[10px] text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What you unlock */}
      <section className="mx-auto w-full max-w-2xl px-4 mt-8 pb-16">
        <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Once you delegate
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: BarChart3,
                title: 'Live report card',
                desc: 'Track your DRep\u2019s score, tier, and voting record',
              },
              {
                icon: Vote,
                title: 'Proposal alerts',
                desc: 'See what\u2019s being voted on and how your DRep responds',
              },
              {
                icon: Bell,
                title: 'Governance updates',
                desc: 'Epoch briefings and smart alerts when it matters',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3 sm:flex-col sm:gap-1.5">
                <Icon className="h-5 w-5 text-primary/60 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── Delegated citizen: the Epoch Briefing experience ──────────── */

export function HomeCitizen({ pulseData, ssrHolderData, ssrWalletAddress }: HomeCitizenProps) {
  const { delegatedDrep } = useSegment();
  const { address } = useWallet();

  const drepId = ssrHolderData?.delegationHealth?.drepId ?? delegatedDrep;
  const wallet = ssrWalletAddress ?? address;

  if (!drepId) {
    return <UndelegatedHome pulseData={pulseData} />;
  }

  return (
    <div className="flex flex-col pb-16">
      {/* Epoch Briefing — the citizen's primary surface */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-6">
        <EpochBriefing drepId={drepId} wallet={wallet} />
      </section>

      {/* Treasury — Where Your Money Goes */}
      <section className="mx-auto w-full max-w-3xl px-4 mt-6">
        <TreasuryCitizenView />
      </section>

      {/* Civic Identity — grows over time */}
      <section className="mx-auto w-full max-w-3xl px-4 mt-6">
        <CivicIdentityCard wallet={wallet} />
      </section>
    </div>
  );
}
