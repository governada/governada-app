'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { useFeatureFlag } from '@/components/FeatureGate';

export function MyGovClient() {
  const civica = useFeatureFlag('civica_frontend');
  const { segment, isLoading, drepId, poolId, delegatedDrep } = useSegment();

  if (civica === null) return null;

  if (!civica) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <p className="text-muted-foreground">This page is not yet available.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <h1 className="font-display text-3xl font-bold tracking-tight mb-4">My Gov</h1>
      <p className="text-muted-foreground mb-8">Your civic command center.</p>

      <div className="rounded-lg border border-border bg-card p-6 space-y-2">
        <p className="text-sm">
          <span className="text-muted-foreground">Segment:</span>{' '}
          <span className="font-medium">{isLoading ? 'Detecting...' : segment}</span>
        </p>
        {drepId && (
          <p className="text-sm">
            <span className="text-muted-foreground">DRep ID:</span>{' '}
            <span className="font-mono text-xs">{drepId}</span>
          </p>
        )}
        {poolId && (
          <p className="text-sm">
            <span className="text-muted-foreground">Pool ID:</span>{' '}
            <span className="font-mono text-xs">{poolId}</span>
          </p>
        )}
        {delegatedDrep && (
          <p className="text-sm">
            <span className="text-muted-foreground">Delegated to:</span>{' '}
            <span className="font-mono text-xs">{delegatedDrep}</span>
          </p>
        )}
      </div>
    </div>
  );
}
