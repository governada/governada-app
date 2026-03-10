'use client';

import { useWallet } from '@/utils/wallet';
import { BarChart3, Lock } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface ScoreAnalysisGateProps {
  drepId: string;
  isClaimed: boolean;
  /** Content visible only to the profile owner */
  ownerContent: ReactNode;
  /** Content visible to everyone (e.g., ScoreHistoryChart) */
  publicContent: ReactNode;
}

/**
 * Gates Score Analysis tab content behind ownership check.
 * - Profile owner (isClaimed + wallet matches): full content
 * - Everyone else: teaser card + public content (score history)
 */
export function ScoreAnalysisGate({
  drepId,
  isClaimed,
  ownerContent,
  publicContent,
}: ScoreAnalysisGateProps) {
  const { isAuthenticated, ownDRepId } = useWallet();
  const isOwner = isClaimed && isAuthenticated && ownDRepId === drepId;

  if (isOwner) {
    return (
      <div className="space-y-6">
        {ownerContent}
        {publicContent}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card px-6 py-8 text-center space-y-3">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-3">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        <p className="text-sm font-medium">
          Score breakdown is available to the DRep who claims this profile.
        </p>
        <Link
          href="/learn/scores"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Learn about DRep Scores
        </Link>
      </div>
      {publicContent}
    </div>
  );
}
