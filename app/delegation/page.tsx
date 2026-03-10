export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Delegation',
  description:
    'Monitor both governance relationships — DRep and stake pool — with governance coverage analysis.',
};

/**
 * /delegation — Governance representation health.
 * Shows DRep + Pool with coverage indicators, conflict detection, gap alerts.
 */
export default function DelegationPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Delegation</h1>
      <p className="text-muted-foreground">
        Governance coverage and representation health will appear here.
      </p>
    </div>
  );
}
