'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Activity, Users, Vote, FileText, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface PulseData {
  totalAdaGoverned: string;
  totalAdaGovernedRaw: number;
  activeProposals: number;
  criticalProposals: number;
  avgParticipationRate: number;
  avgRationaleRate: number;
  totalDReps: number;
  activeDReps: number;
  votesThisWeek: number;
  claimedDReps: number;
  spotlightProposal: {
    txHash: string;
    index: number;
    title: string;
    proposalType: string;
    priority: string;
    voteCoverage: number | null;
  } | null;
  currentEpoch: number;
}

function AnimatedCounter({ value, suffix = '' }: { value: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const numericPart = value.replace(/[^0-9.]/g, '');
    const target = parseFloat(numericPart);
    if (isNaN(target)) {
      el.textContent = value + suffix;
      return;
    }

    const textSuffix = value.replace(/[0-9.,]/g, '') + suffix;
    const duration = 1200;
    const start = performance.now();

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;

      if (target >= 100) {
        el!.textContent = Math.round(current).toLocaleString() + textSuffix;
      } else if (target >= 1) {
        el!.textContent = current.toFixed(1) + textSuffix;
      } else {
        el!.textContent = current.toFixed(1) + textSuffix;
      }

      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }, [value, suffix]);

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  accent?: string;
}

function StatCard({ icon, label, value, suffix, accent = 'text-primary' }: StatCardProps) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-card/60 backdrop-blur-sm border border-border/50"
      role="group"
      aria-label={`${label}: ${value}${suffix || ''}`}
    >
      <div className={`${accent}`}>{icon}</div>
      <span className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight">
        <AnimatedCounter value={value} suffix={suffix} />
      </span>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

export function GovernancePulseHero({ data }: { data: PulseData }) {
  return (
    <section className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-secondary/10 to-accent/15 animate-gradient-shift" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />

      <div className="relative z-10 px-6 py-12 md:py-16 text-center space-y-8 max-w-4xl mx-auto">
        <div className="space-y-3 animate-fade-in-up">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">
            <span className="text-primary">{data.totalAdaGoverned} ADA</span> is being governed
            right now
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Cardano&apos;s on-chain governance is live. DReps vote on proposals that shape the
            protocol&apos;s future — and your ADA gives you a voice.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in-up animation-delay-200">
          <StatCard
            icon={<FileText className="h-5 w-5" />}
            label="Active Proposals"
            value={String(data.activeProposals)}
            accent={data.criticalProposals > 0 ? 'text-red-500' : 'text-primary'}
          />
          <StatCard
            icon={<Activity className="h-5 w-5" />}
            label="Participation Rate"
            value={String(data.avgParticipationRate)}
            suffix="%"
            accent="text-green-500"
          />
          <StatCard
            icon={<Vote className="h-5 w-5" />}
            label="Votes This Week"
            value={String(data.votesThisWeek)}
          />
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="Active DReps"
            value={String(data.activeDReps)}
            accent="text-blue-500"
          />
        </div>

        {data.spotlightProposal && (
          <div className="animate-fade-in-up animation-delay-400">
            <Link
              href={`/proposals/${data.spotlightProposal.txHash}/${data.spotlightProposal.index}`}
              className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-card/80 backdrop-blur-sm border border-primary/20 hover:border-primary/40 transition-all group"
            >
              <Badge variant="outline" className="shrink-0 text-xs border-primary/40 text-primary">
                Live
              </Badge>
              <span className="text-sm font-medium truncate max-w-md">
                {data.spotlightProposal.title}
              </span>
              {data.spotlightProposal.voteCoverage !== null && (
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {data.spotlightProposal.voteCoverage}% voted
                </span>
              )}
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </Link>
          </div>
        )}

        <div className="animate-fade-in-up animation-delay-400">
          <a
            href="#discover-preview"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:opacity-90 transition-all"
          >
            Find Your DRep
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
