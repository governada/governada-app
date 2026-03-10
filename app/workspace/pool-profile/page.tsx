export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Pool Profile',
  description: "Your pool's public governance identity.",
};

export default function PoolProfilePage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Pool Profile</h1>
      <p className="text-muted-foreground">Pool profile editor will appear here.</p>
    </div>
  );
}
