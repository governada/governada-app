'use client';

export const dynamic = 'force-dynamic';

/**
 * Workspace Editor — Tiptap-based proposal workspace.
 *
 * Uses the reusable WorkspaceEmbed component with page-specific overlays:
 * - RevisionJustificationFlow (proposer saves a new version)
 * - EndorsementPrompt (when reviewer comment overlaps feedback theme)
 */

import { useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDraft, useUpdateDraft } from '@/hooks/useDrafts';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useFeedbackThemes } from '@/hooks/useFeedbackThemes';
import { StatusBar } from '@/components/workspace/layout/StatusBar';
import { WorkspaceEmbed } from '@/components/workspace/editor/WorkspaceEmbed';
import { RevisionJustificationFlow } from '@/components/workspace/editor/RevisionJustificationFlow';
import type { ProposalField } from '@/lib/workspace/editor/types';

// ---------------------------------------------------------------------------
// Main workspace page
// ---------------------------------------------------------------------------

function WorkspaceEditorPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = typeof params.draftId === 'string' ? params.draftId : null;
  const { data, isLoading, error } = useDraft(draftId);

  const [showJustificationFlow, setShowJustificationFlow] = useState(false);

  const { stakeAddress, segment } = useSegment();

  const updateDraft = useUpdateDraft(draftId ?? '');

  // --- Derive user role from ownership + segment ---
  const draft = data?.draft ?? null;
  const isOwner = !!stakeAddress && draft?.ownerStakeAddress === stakeAddress;
  const userRole = isOwner
    ? ('proposer' as const)
    : segment === 'cc'
      ? ('cc_member' as const)
      : ('reviewer' as const);

  // --- Derived version data ---
  const versions = data?.versions ?? null;
  const submittedTxHash = draft?.submittedTxHash ?? null;

  // --- Feedback themes (for justification flow) ---
  const { themes: feedbackThemes } = useFeedbackThemes(submittedTxHash, submittedTxHash ? 0 : null);

  // --- Content change handler (auto-save) ---
  const handleContentChange = useCallback(
    (field: ProposalField, content: string) => {
      updateDraft.mutate({ [field]: content });
    },
    [updateDraft],
  );

  // --- Status bar data ---
  const draftStatus = draft?.status;
  const draftTitle = draft?.title ?? '';
  const draftAbstract = draft?.abstract ?? '';
  const draftMotivation = draft?.motivation ?? '';
  const draftRationale = draft?.rationale ?? '';
  const feedbackThemeCount = feedbackThemes.length;

  const statusBarNode = useMemo(() => {
    const completenessChecks = [
      !!draftTitle,
      !!draftAbstract,
      !!draftMotivation,
      !!draftRationale,
      draftTitle.length > 10,
      draftAbstract.length > 50,
    ];
    const done = completenessChecks.filter(Boolean).length;

    return (
      <StatusBar
        completeness={{ done, total: completenessChecks.length }}
        community={{
          reviewerCount: 0,
          themeCount: feedbackThemeCount,
        }}
        userStatus={
          draftStatus === 'draft' ? 'Draft' : (draftStatus?.replace(/_/g, ' ') ?? 'Draft')
        }
      />
    );
  }, [draftTitle, draftAbstract, draftMotivation, draftRationale, draftStatus, feedbackThemeCount]);

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  // --- Error state ---
  if (error || !draft) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <h1 className="text-lg font-semibold">Draft not found</h1>
          <button
            onClick={() => router.push('/workspace/author')}
            className="text-sm text-primary hover:underline"
          >
            Back to Author
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Revision justification flow (proposer saves a new version) */}
      {showJustificationFlow && draft && versions && versions.length > 0 && (
        <RevisionJustificationFlow
          currentContent={{
            title: draft.title,
            abstract: draft.abstract,
            motivation: draft.motivation,
            rationale: draft.rationale,
            proposalType: draft.proposalType,
          }}
          previousContent={versions[versions.length - 1]?.content}
          feedbackThemes={feedbackThemes ?? []}
          onSubmit={() => setShowJustificationFlow(false)}
          onSkip={() => setShowJustificationFlow(false)}
          onCancel={() => setShowJustificationFlow(false)}
        />
      )}

      <WorkspaceEmbed
        proposalId={draftId ?? ''}
        content={{
          title: draft.title,
          abstract: draft.abstract,
          motivation: draft.motivation,
          rationale: draft.rationale,
        }}
        proposalType={draft.proposalType}
        userRole={userRole}
        readOnly={!isOwner}
        onContentChange={handleContentChange}
        backLabel="Back to drafts"
        toolbarActions={
          isOwner ? (
            <button
              onClick={() => setShowJustificationFlow(true)}
              className="mr-4 shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Save Version
            </button>
          ) : undefined
        }
        statusBar={statusBarNode}
      />
    </>
  );
}

export default function WorkspaceEditorRoute() {
  return <WorkspaceEditorPage />;
}
