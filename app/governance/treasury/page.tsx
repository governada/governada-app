export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Treasury',
  description: 'Cardano treasury activity, spending transparency, and funding proposals.',
};

/**
 * /governance/treasury — placeholder.
 * New page: treasury activity and spending transparency.
 */
export default function TreasuryPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Treasury</h1>
      <p className="text-muted-foreground">
        Treasury activity and spending transparency will appear here.
      </p>
    </div>
  );
}
