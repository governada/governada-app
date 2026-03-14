import type { Metadata } from 'next';
import { GlossaryClient } from './GlossaryClient';

export const metadata: Metadata = {
  title: 'Governance Glossary — Governada',
  description:
    'Plain-English definitions for Cardano governance terms. No technical background needed — understand delegation, DReps, proposals, and more.',
  openGraph: {
    title: 'Governance Glossary — Governada',
    description:
      'Plain-English definitions for Cardano governance terms. No technical background needed.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Governance Glossary — Governada',
    description:
      'Plain-English definitions for Cardano governance terms. No technical background needed.',
  },
};

export default function GlossaryPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 sm:px-6 py-6">
      <GlossaryClient />
    </div>
  );
}
