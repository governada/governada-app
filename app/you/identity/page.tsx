export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Identity',
  description: 'Connected wallets, credentials, and verification status.',
};

/**
 * /you/identity — placeholder.
 * Will be populated with content migrated from /my-gov/identity.
 */
export default function IdentityPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Identity</h1>
      <p className="text-muted-foreground">Wallet and credential management will appear here.</p>
    </div>
  );
}
