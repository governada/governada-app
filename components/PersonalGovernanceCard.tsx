'use client';

import Link from 'next/link';
import { ArrowRight, TrendingUp, TrendingDown, Minus, Clock, Users as UsersIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getIdentityColor, type AlignmentDimension } from '@/lib/drepIdentity';

export type UserSegment = 'delegated' | 'undelegated' | 'drep';

interface DelegatedData {
  drepName: string;
  drepId: string;
  drepScore: number;
  scoreTrend: number | null;
  representationMatch: number | null;
  openProposals: number;
  epochCountdown: string;
  dominant: AlignmentDimension;
}

interface DRepData {
  drepId: string;
  drepScore: number;
  scoreTrend: number | null;
  rank: number;
  totalRanked: number;
  delegatorCount: number;
  pendingProposals: number;
  dominant: AlignmentDimension;
}

interface UndelegatedData {
  totalAdaGoverned: string;
}

interface PersonalGovernanceCardProps {
  segment: UserSegment;
  delegated?: DelegatedData;
  drep?: DRepData;
  undelegated?: UndelegatedData;
}

function TrendArrow({ value }: { value: number | null }) {
  if (value == null || value === 0) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  if (value > 0) return (
    <span className="flex items-center gap-0.5 text-green-500 text-sm font-medium">
      <TrendingUp className="h-3.5 w-3.5" />+{value}
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-red-500 text-sm font-medium">
      <TrendingDown className="h-3.5 w-3.5" />{value}
    </span>
  );
}

function DelegatedCard({ data }: { data: DelegatedData }) {
  const color = getIdentityColor(data.dominant);

  return (
    <Card className="animate-slide-up overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: color.hex }} />
      <CardContent className="p-5 pl-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: color.hex }}
            >
              {data.drepScore}
            </div>
            <div>
              <Link href={`/drep/${data.drepId}`} className="font-semibold hover:text-primary transition-colors">
                {data.drepName}
              </Link>
              <p className="text-xs text-muted-foreground">Your representative</p>
            </div>
          </div>
          <TrendArrow value={data.scoreTrend} />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Representation</p>
            <p className="text-lg font-semibold tabular-nums">
              {data.representationMatch != null ? `${data.representationMatch}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Open Proposals</p>
            <p className="text-lg font-semibold tabular-nums">
              {data.openProposals}
              {data.openProposals > 0 && (
                <span className="text-xs text-muted-foreground font-normal ml-1">need vote</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Epoch
            </p>
            <p className="text-lg font-semibold tabular-nums">{data.epochCountdown}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href="/governance"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            My Governance
          </Link>
          <Link
            href="/proposals"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            View Proposals <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function UndelegatedCard({ data }: { data: UndelegatedData }) {
  return (
    <Card className="animate-slide-up border-amber-500/20">
      <CardContent className="p-6 text-center">
        <h3 className="text-lg font-semibold mb-2">Your ADA is unrepresented</h3>
        <p className="text-sm text-muted-foreground mb-1">
          {data.totalAdaGoverned} ADA has a voice in Cardano governance. Yours doesn&apos;t yet.
        </p>
        <p className="text-xs text-muted-foreground mb-5">
          Delegation is free, non-custodial, and takes 30 seconds.
        </p>
        <Link
          href="/discover"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Find Your Representative <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

function DRepCard({ data }: { data: DRepData }) {
  const color = getIdentityColor(data.dominant);

  return (
    <Card className="animate-slide-up overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: color.hex }} />
      <CardContent className="p-5 pl-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold">Your DRep Profile</p>
            <p className="text-xs text-muted-foreground">
              Score: <span className="text-foreground font-medium">{data.drepScore}</span>
            </p>
          </div>
          <TrendArrow value={data.scoreTrend} />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Rank</p>
            <p className="text-lg font-semibold tabular-nums">
              #{data.rank} <span className="text-xs text-muted-foreground font-normal">of {data.totalRanked}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <UsersIcon className="h-3 w-3" /> Delegators
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {data.delegatorCount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-lg font-semibold tabular-nums">
              {data.pendingProposals}
              {data.pendingProposals > 0 && (
                <span className="text-xs text-muted-foreground font-normal ml-1">proposals</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Open Dashboard
          </Link>
          <Link
            href="/proposals"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            View Proposals <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function PersonalGovernanceCard({ segment, delegated, drep, undelegated }: PersonalGovernanceCardProps) {
  if (segment === 'delegated' && delegated) {
    return <DelegatedCard data={delegated} />;
  }
  if (segment === 'drep' && drep) {
    return <DRepCard data={drep} />;
  }
  if (segment === 'undelegated') {
    return <UndelegatedCard data={undelegated || { totalAdaGoverned: '17.2B' }} />;
  }
  return null;
}
