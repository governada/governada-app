import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Help',
  description: 'Find answers to governance questions. FAQ, glossary, methodology, and support.',
};

/**
 * /help — Help center.
 * Will be populated with FAQ + search + quick links.
 */
export default function HelpPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Help</h1>
      <p className="text-muted-foreground">FAQ and help center will appear here.</p>
    </div>
  );
}
