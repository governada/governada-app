'use client';

import Link from 'next/link';
import { Zap, ArrowRight, Vote, BarChart3, Bell, Gavel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GovTerm } from '@/components/GovTerm';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet';
import dynamic from 'next/dynamic';

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false, loading: () => <div className="w-full h-full bg-background" /> },
);
import { EpochBriefing } from './EpochBriefing';

function formatAdaShort(ada: number): string {
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toLocaleString();
}

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
  ssrHolderData?: Record<string, unknown>;
  ssrWalletAddress?: string | null;
}

/* ── Undelegated citizen: wallet connected but no DRep ──────────── */

function UndelegatedHome({ pulseData }: { pulseData: PulseData }) {
  const { balanceAda } = useWallet();

  const stats = [
    {
      label: 'ADA with a Voice',
      value: `₳${pulseData.totalAdaGoverned}`,
      sub: 'yours isn\u2019t counted yet',
    },
    { label: 'Representatives', value: pulseData.activeDReps, sub: 'ready to vote for you' },
    { label: 'Open Decisions', value: pulseData.activeProposals, sub: 'being voted on now' },
    { label: 'Decisions This Week', value: pulseData.votesThisWeek, sub: 'and counting' },
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
              {balanceAda != null && balanceAda > 0 ? (
                <>
                  Your <span className="text-primary">&#x20B3;{formatAdaShort(balanceAda)}</span>{' '}
                  isn&apos;t being used to vote.
                </>
              ) : (
                <>
                  Your ADA is <span className="text-primary">unrepresented</span>.
                </>
              )}
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
                  Decisions are being made every week — choose a{' '}
                  <GovTerm term="drep">representative</GovTerm> so your ADA has a say.
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
              Find a <GovTerm term="drep">representative</GovTerm> who thinks like you
            </h2>
            <p className="text-sm text-muted-foreground">
              Answer 3 quick questions about what matters to you, and we&apos;ll find
              representatives who think the same way — or browse them yourself.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild size="lg" className="flex-1">
              <Link href="/match">
                <Zap className="mr-2 h-4 w-4" />
                Find My Representative — 60s
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1">
              <Link href="/governance/representatives">Browse all representatives</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Consequence framing — gentle nudge about what they're missing */}
      {(pulseData.votesThisWeek > 0 || pulseData.activeProposals > 0) && (
        <section className="mx-auto w-full max-w-2xl px-4 mt-6">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
            <Gavel className="h-5 w-5 text-amber-500/70 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-sm text-foreground/80 leading-relaxed">
                {pulseData.votesThisWeek > 0 ? (
                  <>
                    Last epoch,{' '}
                    <span className="font-semibold text-amber-400">
                      {pulseData.votesThisWeek} decisions
                    </span>{' '}
                    were cast &mdash; your ADA had no voice.
                  </>
                ) : (
                  <>
                    There are{' '}
                    <span className="font-semibold text-amber-400">
                      {pulseData.activeProposals} open proposals
                    </span>{' '}
                    being decided right now &mdash; without your input.
                  </>
                )}
              </p>
              {Number(pulseData.totalAdaGoverned.replace(/,/g, '')) > 0 && (
                <p className="text-xs text-muted-foreground">
                  &#x20B3;{pulseData.totalAdaGoverned} is already represented. Yours could be too.
                </p>
              )}
              <Link
                href="/match"
                className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors mt-0.5"
              >
                Find my representative <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>
      )}

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
            Once you choose a representative
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: BarChart3,
                title: 'Live report card',
                desc: 'See how your representative is voting and performing',
              },
              {
                icon: Vote,
                title: 'Decision alerts',
                desc: 'Know what decisions are being made and how your representative votes',
              },
              {
                icon: Bell,
                title: 'Updates that matter',
                desc: 'Get alerts when important decisions happen',
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

  const drepId =
    ((ssrHolderData?.delegationHealth as Record<string, unknown> | undefined)?.drepId as
      | string
      | undefined) ?? delegatedDrep;
  const wallet = ssrWalletAddress ?? address;

  if (!drepId) {
    return <UndelegatedHome pulseData={pulseData} />;
  }

  return (
    <div className="relative flex flex-col">
      {/* ── Constellation hero (25vh) — visual backdrop for briefing ── */}
      <section className="relative h-[25vh] min-h-[180px] sm:-mt-14 overflow-hidden">
        <div className="absolute inset-0">
          <ConstellationScene className="w-full h-full" interactive={false} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </section>

      {/* Epoch Briefing — overlaps the hero for visual continuity */}
      <section className="mx-auto w-full max-w-2xl px-4 sm:px-6 -mt-4 pb-16 relative z-10">
        <EpochBriefing wallet={wallet} />
      </section>
    </div>
  );
}
