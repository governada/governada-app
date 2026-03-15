'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { posthog } from '@/lib/posthog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Sparkles,
  Inbox,
  TrendingUp,
  ArrowRight,
  Loader2,
  ExternalLink,
  Users,
  Trophy,
  BarChart3,
  Eye,
  Lock,
} from 'lucide-react';
import { ClaimCelebration } from '@/components/ClaimCelebration';

interface ClaimPageClientProps {
  drepId: string;
  name: string;
  score: number;
  engagement: number;
  participation: number;
  reliability: number;
  identity: number;
  isClaimed: boolean;
}

interface PulseData {
  votesThisWeek: number;
  activeDReps: number;
  claimedDReps: number;
  activeProposals: number;
}

interface TopDRep {
  drepId: string;
  name: string;
  score: number;
}

function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score)) / 100;
  const dashOffset = circumference * (1 - progress);
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className="text-3xl font-bold tabular-nums" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

function PillarBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / 100) * 100);
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const points = Math.round((value / 100) * max);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums w-10 text-right">
        {points}/{max}
      </span>
    </div>
  );
}

function getLowestPillar(p: {
  engagement: number;
  participation: number;
  reliability: number;
  identity: number;
}) {
  const pillars = [
    { key: 'Engagement Quality', value: p.engagement },
    { key: 'Effective Participation', value: p.participation },
    { key: 'Reliability', value: p.reliability },
    { key: 'Governance Identity', value: p.identity },
  ];
  return pillars.reduce((min, curr) => (curr.value < min.value ? curr : min));
}

export function ClaimPageClient({
  drepId,
  name,
  score,
  engagement,
  participation,
  reliability,
  identity,
  isClaimed,
}: ClaimPageClientProps) {
  const router = useRouter();
  const { isAuthenticated, ownDRepId, connecting, reconnecting } = useWallet();
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [topDreps, setTopDreps] = useState<TopDRep[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const lowestPillar = useMemo(
    () => getLowestPillar({ engagement, participation, reliability, identity }),
    [engagement, participation, reliability, identity],
  );

  useEffect(() => {
    posthog.capture('claim_page_viewed', {
      drep_id: drepId,
      drep_score: score,
      is_claimed: isClaimed,
    });
    fetch('/api/governance/pulse')
      .then((r) => r.json())
      .then((d) =>
        setPulse({
          votesThisWeek: d.votesThisWeek,
          activeDReps: d.activeDReps,
          claimedDReps: d.claimedDReps,
          activeProposals: d.activeProposals,
        }),
      )
      .catch(() => {});
    fetch('/api/dreps?limit=3&sort=score&claimed=true')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d))
          setTopDreps(
            d.slice(0, 3).map((x: Record<string, unknown>) => ({
              drepId: x.drepId as string,
              name: (x.name as string) || (x.drepId as string).slice(0, 16),
              score: x.drepScore as number,
            })),
          );
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once on mount; drepId/score/isClaimed are stable server props
  }, []);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !ownDRepId ||
      ownDRepId !== drepId ||
      isClaimed ||
      claiming ||
      showCelebration
    )
      return;
    const token = getStoredSession();
    if (!token) return;
    setClaiming(true);
    posthog.capture('claim_initiated', { drep_id: drepId });
    fetch('/api/drep-claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: token, drepId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.claimed) {
          posthog.capture('claim_completed', {
            drep_id: drepId,
            drep_score: score,
            source: 'claim_page',
          });
          posthog.capture('drep_profile_claimed', {
            drep_id: drepId,
            drep_score: score,
          });
          setShowCelebration(true);
          posthog.capture('claim_celebration_seen', { drep_id: drepId });
        }
      })
      .catch(() => {})
      .finally(() => setClaiming(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- score is stable server prop, not needed as dep
  }, [isAuthenticated, ownDRepId, drepId, isClaimed, claiming, showCelebration]);

  if (claiming || (isAuthenticated && ownDRepId === drepId && !showCelebration)) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-lg text-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground">Claiming your profile...</p>
      </div>
    );
  }

  if (showCelebration) {
    return (
      <ClaimCelebration
        name={name}
        score={score}
        participation={participation}
        rationale={engagement}
        reliability={reliability}
        profile={identity}
        onContinue={() => router.push('/my-gov')}
      />
    );
  }

  if (isClaimed) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-lg text-center space-y-6">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
        <h1 className="text-2xl font-bold">Profile Already Claimed</h1>
        <p className="text-sm text-muted-foreground">
          This DRep profile has been claimed by its owner.
        </p>
        <Link href={`/drep/${encodeURIComponent(drepId)}`}>
          <Button variant="outline" className="gap-2">
            View Public Profile <ExternalLink className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl space-y-8">
      {/* Outcome-driven hero */}
      <div className="text-center space-y-4">
        <Badge variant="secondary" className="text-xs">
          Unclaimed Profile
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
        {pulse && (
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            <span className="font-semibold text-foreground">
              {pulse.votesThisWeek.toLocaleString()}
            </span>{' '}
            votes cast this week across{' '}
            <span className="font-semibold text-foreground">{pulse.activeDReps}</span> active DReps.
            Your profile is live.{' '}
            <span className="font-medium text-primary">Own your reputation.</span>
          </p>
        )}
      </div>

      {/* Score + biggest opportunity */}
      <div className="flex flex-col items-center space-y-4">
        <ScoreRing score={score} />
        <div className="space-y-2 w-full max-w-md">
          <PillarBar label="Engagement" value={engagement} max={35} />
          <PillarBar label="Participation" value={participation} max={25} />
          <PillarBar label="Reliability" value={reliability} max={25} />
          <PillarBar label="Identity" value={identity} max={15} />
        </div>
        <p className="text-xs text-muted-foreground">
          Biggest opportunity:{' '}
          <span className="font-semibold text-foreground">{lowestPillar.key}</span> (
          {lowestPillar.value}%) — claim to get actionable steps
        </p>
      </div>

      {/* Blurred dashboard preview */}
      <Card className="relative overflow-hidden border-primary/20">
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <Lock className="h-6 w-6 text-primary mb-2" />
          <p className="text-sm font-semibold">Unlock your command center</p>
          <p className="text-xs text-muted-foreground">
            Governance Inbox, Score Simulator, Delegator Analytics
          </p>
        </div>
        <CardContent className="py-6 opacity-40 pointer-events-none select-none">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 rounded-lg bg-muted animate-pulse" />
            <div className="h-20 rounded-lg bg-muted animate-pulse" />
            <div className="h-32 rounded-lg bg-muted animate-pulse col-span-2" />
            <div className="h-16 rounded-lg bg-muted animate-pulse" />
            <div className="h-16 rounded-lg bg-muted animate-pulse" />
          </div>
        </CardContent>
      </Card>

      {/* Social proof */}
      {(pulse?.claimedDReps ?? 0) > 0 && (
        <div className="text-center space-y-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{pulse!.claimedDReps}</span> DReps have
            claimed their profile
          </p>
          {topDreps.length > 0 && (
            <div className="flex justify-center gap-3">
              {topDreps.map((d) => (
                <Link
                  key={d.drepId}
                  href={`/drep/${encodeURIComponent(d.drepId)}`}
                  className="text-center group"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-1 group-hover:bg-primary/20 transition-colors">
                    <Trophy className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-[10px] font-medium truncate max-w-[80px]">{d.name}</p>
                  <p className="text-[10px] text-muted-foreground">{d.score}/100</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* What you get */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="pt-6 space-y-3">
          <h2 className="text-sm font-semibold text-center mb-4">What you unlock</h2>
          <div className="grid gap-2">
            <ValueProp
              icon={<BarChart3 className="h-4 w-4 text-primary" />}
              title="Score Simulator"
              desc="See exactly how your score changes with each vote and rationale"
            />
            <ValueProp
              icon={<Inbox className="h-4 w-4 text-primary" />}
              title="Governance Inbox"
              desc="Prioritized proposals with deadlines, impact scores, and AI rationale drafting"
            />
            <ValueProp
              icon={<Users className="h-4 w-4 text-primary" />}
              title="Delegator Analytics"
              desc="Track delegator growth, profile views, and representation alignment"
            />
            <ValueProp
              icon={<TrendingUp className="h-4 w-4 text-primary" />}
              title="Competitive Context"
              desc="Your rank, nearby DReps, and a path to the top 10"
            />
            <ValueProp
              icon={<Eye className="h-4 w-4 text-primary" />}
              title="Notifications"
              desc="Score changes, delegation shifts, proposal deadlines — push, Discord, or Telegram"
            />
            <ValueProp
              icon={<Sparkles className="h-4 w-4 text-primary" />}
              title="Milestones & Report Cards"
              desc="Earn achievement badges and share branded score cards"
            />
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="text-center space-y-4 pb-8">
        <Button
          size="lg"
          className="gap-2 text-base px-8"
          onClick={() => {
            posthog.capture('claim_wallet_connect_clicked', { drep_id: drepId });
            window.dispatchEvent(new Event('openWalletConnect'));
          }}
          disabled={connecting || reconnecting}
        >
          {connecting || reconnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Shield className="h-5 w-5" />
          )}
          Connect Wallet to Claim
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Read-only signature verification — we never request transactions or access to your funds.
        </p>
      </div>
    </div>
  );
}

function ValueProp({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-background/60">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
