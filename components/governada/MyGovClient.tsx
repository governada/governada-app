'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, LayoutDashboard, Shield, ShieldCheck, Vote, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useSegment } from '@/components/providers/SegmentProvider';
import { FirstVisitBanner } from '@/components/ui/FirstVisitBanner';
import { CIVIC_IDENTITY_PATH } from '@/lib/navigation/civicIdentity';
import { CitizenCommandCenter } from './mygov/CitizenCommandCenter';
import { DRepCommandCenter } from './mygov/DRepCommandCenter';
import { SPOCommandCenter } from './mygov/SPOCommandCenter';

const MY_GOV_SUBNAV = [
  { href: '/my-gov', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: CIVIC_IDENTITY_PATH, label: 'Identity', icon: Shield, exact: false },
  { href: '/my-gov/profile', label: 'Profile', icon: User, exact: false },
] as const;

function MyGovSubNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-border/50 -mx-4 sm:-mx-6 px-4 sm:px-6 mb-6">
      {MY_GOV_SUBNAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors relative',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {active && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function ConnectPrompt() {
  const features = [
    {
      icon: ShieldCheck,
      title: 'Delegation Health',
      desc: 'See how your DRep is performing and if they are representing you well',
    },
    {
      icon: Vote,
      title: 'Open Proposals',
      desc: 'Track active governance proposals and how your DRep voted',
    },
    {
      icon: TrendingUp,
      title: 'Action Recommendations',
      desc: 'Get personalized suggestions to strengthen your governance participation',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
        <p className="text-lg font-bold">Your Civic Command Center</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Connect your Cardano wallet to see your personalized governance dashboard — delegation
          health, voting activity, and action recommendations.
        </p>
        <Button
          onClick={() => window.dispatchEvent(new CustomEvent('openWalletConnect', { detail: {} }))}
        >
          Connect Wallet
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-2 opacity-70"
          >
            <Icon className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MyGovClient() {
  const { segment, isLoading, drepId, poolId, delegatedDrep } = useSegment();

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">My Gov</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your civic command center.</p>
      </div>

      <MyGovSubNav />

      <FirstVisitBanner
        pageKey="my-gov"
        message="Your governance command center. Track your delegation health, milestones, and activity all in one place."
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-36 w-full rounded-xl" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : segment === 'anonymous' ? (
        <ConnectPrompt />
      ) : segment === 'drep' && drepId ? (
        <DRepCommandCenter drepId={drepId} />
      ) : segment === 'spo' && poolId ? (
        <SPOCommandCenter poolId={poolId} />
      ) : (
        <CitizenCommandCenter delegatedDrep={delegatedDrep} />
      )}
    </div>
  );
}
