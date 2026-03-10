import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Glossary',
  description: 'Governance terminology and definitions for Cardano governance.',
};

export default function GlossaryPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Glossary</h1>
      <p className="text-muted-foreground">Governance terminology will appear here.</p>
    </div>
  );
}
