'use client';

export const dynamic = 'force-dynamic';

/**
 * Workspace Editor V2 — Tiptap-based proposal workspace.
 *
 * Feature-flagged behind `governance_workspace_v2`.
 * Phase 0C shell: editor + layout + placeholder chat + status bar.
 */

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDraft, useUpdateDraft } from '@/hooks/useDrafts';
import { FeatureGate } from '@/components/FeatureGate';
import { WorkspaceLayout } from '@/components/workspace/layout/WorkspaceLayout';
import { WorkspaceToolbar } from '@/components/workspace/layout/WorkspaceToolbar';
import { StatusBar } from '@/components/workspace/layout/StatusBar';
import { ProposalEditor } from '@/components/workspace/editor/ProposalEditor';
import { PROPOSAL_TYPE_LABELS } from '@/lib/workspace/types';
import type { EditorMode, ProposalField } from '@/lib/workspace/editor/types';
import { MessageSquare } from 'lucide-react';

function WorkspaceEditorPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = typeof params.draftId === 'string' ? params.draftId : null;
  const { data, isLoading, error } = useDraft(draftId);

  const [mode, setMode] = useState<EditorMode>('edit');

  const updateDraft = useUpdateDraft(draftId ?? '');

  const handleContentChange = useCallback(
    (field: ProposalField, content: string) => {
      updateDraft.mutate({ [field]: content });
    },
    [updateDraft],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (error || !data?.draft) {
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

  const { draft, versions } = data;
  const typeLabel = PROPOSAL_TYPE_LABELS[draft.proposalType] ?? draft.proposalType;

  return (
    <WorkspaceLayout
      toolbar={
        <WorkspaceToolbar
          title={draft.title}
          proposalType={typeLabel}
          mode={mode}
          onModeChange={setMode}
          versions={versions?.map((v) => ({
            versionNumber: v.versionNumber,
            versionName: v.versionName,
          }))}
        />
      }
      editor={
        <ProposalEditor
          content={{
            title: draft.title,
            abstract: draft.abstract,
            motivation: draft.motivation,
            rationale: draft.rationale,
          }}
          mode={mode}
          onContentChange={handleContentChange}
          readOnly={mode === 'review'}
        />
      }
      chat={
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Agent</span>
          </div>
          <div className="flex-1 flex items-center justify-center p-6">
            <p className="text-sm text-muted-foreground text-center">
              AI agent coming soon. This panel will host your persistent, context-aware conversation
              about this proposal.
            </p>
          </div>
        </div>
      }
      statusBar={
        <StatusBar
          constitutional={{ status: 'pass', flagCount: 0 }}
          completeness={{ done: 0, total: 6 }}
          community={{ reviewerCount: 0, themeCount: 0 }}
          userStatus="Draft"
        />
      }
    />
  );
}

export default function WorkspaceEditorRoute() {
  return (
    <FeatureGate flag="governance_workspace_v2" fallback={<FlagDisabledFallback />}>
      <WorkspaceEditorPage />
    </FeatureGate>
  );
}

function FlagDisabledFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center space-y-3">
        <h1 className="text-lg font-semibold">Workspace V2</h1>
        <p className="text-sm text-muted-foreground">
          This feature is not yet enabled. Check back soon.
        </p>
      </div>
    </div>
  );
}
