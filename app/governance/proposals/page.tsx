export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Proposals',
  description:
    'Active governance proposals in Cardano. See what is being decided, voting deadlines, and stake impact.',
};

/**
 * /governance/proposals — placeholder.
 * Will be populated with content migrated from /discover?tab=proposals.
 */
export default function ProposalsPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Proposals</h1>
      <p className="text-muted-foreground">Active governance proposals will appear here.</p>
    </div>
  );
}
