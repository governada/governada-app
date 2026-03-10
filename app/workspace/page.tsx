export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Workspace',
  description: 'Your governance workspace. Action queue for DReps, governance score for SPOs.',
};

/**
 * /workspace — DRep default: Action Queue. SPO default: Gov Score.
 * Placeholder — will render persona-appropriate workspace content.
 */
export default function WorkspacePage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Workspace</h1>
      <p className="text-muted-foreground">Your governance workspace will appear here.</p>
    </div>
  );
}
