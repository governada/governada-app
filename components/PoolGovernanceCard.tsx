'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface PoolGovernanceCardProps {
  walletAddress?: string;
}

export function PoolGovernanceCard({}: PoolGovernanceCardProps) {
  return (
    <Card className="border-cyan-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-500" />
          Pool Governance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Track your staking pool&apos;s governance participation.
          <Link href="/governance/pools" className="text-cyan-500 hover:underline ml-1">
            Explore governance-active pools &rarr;
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
