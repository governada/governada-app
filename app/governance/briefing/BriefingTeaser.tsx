'use client';

import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  Wallet,
  Lock,
  BarChart3,
  Users,
  Vote,
  Bell,
  TrendingUp,
  Landmark,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PublicHeadline {
  title: string;
  description: string;
  type?: string;
  href?: string;
}

interface PublicBriefingData {
  epoch: number;
  headline: PublicHeadline | null;
  headlines: PublicHeadline[];
  narrative: string | null;
  epochStats: {
    activeProposals: number;
    totalDReps: number;
    treasuryBalance?: number;
  };
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function fetchPublicBriefing(): Promise<PublicBriefingData | null> {
  const res = await fetch('/api/briefing/public');
  if (!res.ok) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// Gated feature descriptions — what authenticated users get
// ---------------------------------------------------------------------------

const GATED_FEATURES = [
  {
    icon: BarChart3,
    title: 'Your DRep Performance',
    description:
      'See how your representative voted, their score trend, and a plain-English verdict on their engagement.',
  },
  {
    icon: Vote,
    title: 'Your Voice This Epoch',
    description:
      'Track how your sentiment aligned with the community and whether your DRep voted the way you expected.',
  },
  {
    icon: TrendingUp,
    title: 'Looking Ahead',
    description:
      'Proposals expiring soon, DRep score trends, and what to watch for in the next epoch.',
  },
  {
    icon: Bell,
    title: 'Briefing Notifications',
    description:
      'Get notified when a new epoch briefing is ready — never miss a governance update that affects your ADA.',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * BriefingTeaser — Public epoch briefing page for anonymous visitors.
 *
 * Shows the public briefing data in full (headlines, narrative, stats),
 * then teases the personalized features behind a connect-wallet CTA.
 */
export function BriefingTeaser() {
  const { data, isLoading } = useQuery({
    queryKey: ['public-briefing'],
    queryFn: fetchPublicBriefing,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <BriefingTeaserSkeleton />;
  if (!data) return null;

  const { epoch, headlines, narrative, epochStats } = data;
  const treasuryFormatted = epochStats.treasuryBalance
    ? epochStats.treasuryBalance >= 1_000_000_000
      ? `${(epochStats.treasuryBalance / 1_000_000_000).toFixed(1)}B`
      : epochStats.treasuryBalance >= 1_000_000
        ? `${(epochStats.treasuryBalance / 1_000_000).toFixed(1)}M`
        : epochStats.treasuryBalance.toLocaleString()
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <Badge variant="secondary" className="text-xs">
            Epoch {epoch}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Governance Briefing</h1>
        <p className="text-sm text-muted-foreground">
          What happened in Cardano governance last epoch — powered by on-chain data and AI analysis.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={Vote}
          label="Active Proposals"
          value={epochStats.activeProposals.toString()}
        />
        <StatCard
          icon={Users}
          label="Active DReps"
          value={epochStats.totalDReps.toLocaleString()}
        />
        <StatCard
          icon={Landmark}
          label="Treasury"
          value={treasuryFormatted ? `${treasuryFormatted} ADA` : '—'}
        />
      </div>

      {/* Headlines */}
      {headlines.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Headlines
          </h2>
          <div className="space-y-3">
            {headlines.map((h, i) => (
              <Link
                key={i}
                href={h.href ?? '/governance'}
                className="block rounded-xl border border-white/[0.08] bg-card/60 backdrop-blur-xl p-4 transition-all duration-200 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
              >
                <p className="text-sm font-semibold text-foreground">{h.title}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {h.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* AI Narrative */}
      {narrative && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            AI Analysis
          </h2>
          <div className="rounded-xl border border-white/[0.08] bg-card/60 backdrop-blur-xl p-4">
            <p className="text-sm leading-relaxed text-foreground/90">{narrative}</p>
          </div>
        </div>
      )}

      {/* Gated section — what you get with a wallet */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Personalized for you — connect to unlock
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GATED_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-white/[0.06] bg-card/40 backdrop-blur-lg p-4 opacity-60"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <feature.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground/70">{feature.title}</span>
              </div>
              <p className="text-xs text-muted-foreground/70 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-center space-y-3">
          <p className="text-sm font-medium text-foreground">
            Get your personalized governance briefing every epoch
          </p>
          <p className="text-xs text-muted-foreground">
            Connect your wallet to see how your DRep is performing, track your governance impact,
            and get notified when new briefings are ready.
          </p>
          <Button asChild size="lg" className="gap-2">
            <Link href="/match">
              <Wallet className="h-4 w-4" />
              Connect Wallet
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Vote;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-card/60 backdrop-blur-xl p-3 text-center">
      <Icon className="h-4 w-4 text-primary mx-auto mb-1" />
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function BriefingTeaserSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    </div>
  );
}
