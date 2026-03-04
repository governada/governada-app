'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGovernanceInterBody } from '@/hooks/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';

interface SystemAlignment {
  proposalCount: number;
  avgAlignmentScore: number;
  drepSpoAgreement: number;
  drepCcAgreement: number;
  spoCcAgreement: number;
  byProposalType: Record<string, { count: number; avgAlignment: number }>;
}

function AlignmentBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-muted/30 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function InterBodyPulse() {
  const { data: rawData, isLoading } = useGovernanceInterBody();
  const data = (rawData as SystemAlignment) ?? null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.proposalCount === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          Inter-Body Governance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Across {data.proposalCount} proposals, governance bodies show{' '}
          <span className="font-medium text-foreground">{data.avgAlignmentScore}%</span> average
          alignment.
        </p>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums text-primary">
                {data.drepSpoAgreement}%
              </p>
              <p className="text-xs text-muted-foreground">DRep–SPO</p>
            </div>
            <AlignmentBar value={data.drepSpoAgreement} color="hsl(var(--primary))" />
          </div>
          <div className="space-y-2">
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums text-cyan-500">
                {data.drepCcAgreement}%
              </p>
              <p className="text-xs text-muted-foreground">DRep–CC</p>
            </div>
            <AlignmentBar value={data.drepCcAgreement} color="rgb(6, 182, 212)" />
          </div>
          <div className="space-y-2">
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums text-amber-500">
                {data.spoCcAgreement}%
              </p>
              <p className="text-xs text-muted-foreground">SPO–CC</p>
            </div>
            <AlignmentBar value={data.spoCcAgreement} color="rgb(245, 158, 11)" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
