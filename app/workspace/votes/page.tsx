export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Voting Record',
  description: 'Your governance voting history with rationale status.',
};

export default function VotesPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Voting Record</h1>
      <p className="text-muted-foreground">Your voting history will appear here.</p>
    </div>
  );
}
