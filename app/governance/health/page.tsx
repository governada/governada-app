export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Governance Health',
  description:
    "Governance Health Index — is Cardano's governance healthy? GHI score, participation trends, and epoch history.",
};

/**
 * /governance/health — placeholder.
 * Will be populated with content migrated from /pulse.
 */
export default function HealthPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Governance Health</h1>
      <p className="text-muted-foreground">Governance Health Index will appear here.</p>
    </div>
  );
}
