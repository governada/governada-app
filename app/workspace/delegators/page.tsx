export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Delegators',
  description: 'Who trusts you and how to engage them. Delegator management and communication.',
};

export default function DelegatorsPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Delegators</h1>
      <p className="text-muted-foreground">Delegator management will appear here.</p>
    </div>
  );
}
