export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Pools',
  description:
    'Find governance-active Cardano stake pools. Sort by governance score and participation.',
};

/**
 * /governance/pools — placeholder.
 * Will be populated with content migrated from /discover?tab=spos.
 */
export default function PoolsPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Pools</h1>
      <p className="text-muted-foreground">
        Governance-active stake pool directory will appear here.
      </p>
    </div>
  );
}
