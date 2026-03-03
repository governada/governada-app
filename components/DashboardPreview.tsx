'use client';

import { Shield, Activity, Vote, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

function MockDelegationCard() {
  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Delegation Health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-green-500" />
          <div>
            <p className="font-semibold">ExampleDRep</p>
            <p className="text-xs text-muted-foreground">Score: 82/100</p>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>Alignment</span>
            <span>76%</span>
          </div>
          <Progress value={76} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  );
}

function MockScoreRing() {
  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Representation</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center py-4">
        <div className="relative h-20 w-20">
          <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              className="text-muted/30"
              strokeWidth="3"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              className="text-green-500"
              strokeWidth="3"
              strokeDasharray="72, 100"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
            72%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function MockProposals() {
  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Active Proposals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {['Budget Allocation Q2', 'Protocol Parameter Update', 'Treasury Withdrawal'].map(
          (name, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0"
            >
              <div className="flex items-center gap-2">
                <Vote className="h-3 w-3 text-muted-foreground" />
                <span>{name}</span>
              </div>
              <span className="text-muted-foreground">Pending</span>
            </div>
          ),
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardPreview() {
  const openWalletConnect = () => {
    window.dispatchEvent(new Event('openWalletConnect'));
  };

  return (
    <section className="relative">
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-4 blur-[2px] select-none pointer-events-none"
        aria-hidden="true"
      >
        <MockDelegationCard />
        <MockScoreRing />
        <MockProposals />
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-background/80 via-background/50 to-background/30 rounded-xl">
        <div className="text-center space-y-4 px-6">
          <div className="flex items-center justify-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Your Governance Dashboard</h3>
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            Connect your wallet to see your delegation health, representation score, and active
            proposals.
          </p>
          <button
            onClick={openWalletConnect}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
          >
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </button>
        </div>
      </div>
    </section>
  );
}
