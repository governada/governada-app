'use client';

export const dynamic = 'force-dynamic';

/**
 * Outcome Debrief Page — post-mortem for proposals with a terminal status.
 *
 * Accessible only when the proposal is ratified, expired, or dropped.
 * Shows final voting breakdown, where it fell short, review feedback summary,
 * and a "Fork & Revise" action to iterate on the proposal.
 */

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { FeatureGate } from '@/components/FeatureGate';
import { useDraft } from '@/hooks/useDrafts';
import { OutcomeDebrief } from '@/components/workspace/author/debrief/OutcomeDebrief';

// ---------------------------------------------------------------------------
// Inner component
// ---------------------------------------------------------------------------

function DebriefPageInner() {
  const params = useParams();
  const router = useRouter();
  const draftId = typeof params.draftId === 'string' ? params.draftId : null;

  const { data: draftData, isLoading } = useDraft(draftId);
  const draft = draftData?.draft ?? null;

  // Only accessible for submitted proposals — redirect others back to portfolio
  useEffect(() => {
    if (!isLoading && draft && draft.status !== 'submitted') {
      router.replace(`/workspace/author/${draftId}`);
    }
  }, [draft, isLoading, draftId, router]);

  if (isLoading || !draft) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[var(--compass-teal)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
            href="/workspace/author"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to portfolio
          </Link>
          <h1 className="text-xl font-display font-semibold text-foreground">Outcome Debrief</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <OutcomeDebrief draft={draft} draftId={draftId!} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported page
// ---------------------------------------------------------------------------

export default function DebriefPage() {
  return (
    <FeatureGate flag="governance_action_submission">
      <DebriefPageInner />
    </FeatureGate>
  );
}
