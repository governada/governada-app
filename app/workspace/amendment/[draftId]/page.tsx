'use client';

export const dynamic = 'force-dynamic';

/**
 * Amendment Editor Page — Constitution amendment workspace using Studio shell.
 *
 * Follows the same StudioProvider + StudioHeader/StudioPanel/StudioActionBar
 * pattern as the proposal editor page, but uses ConstitutionEditor as the
 * main editing surface and adds amendment-specific metadata/intel.
 *
 * Supports two entry modes:
 * - Direct: user edits the constitution text in suggest mode
 * - Intent: user describes what they want to change, AI generates amendments
 */

import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useDraft, useUpdateDraft } from '@/hooks/useDrafts';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useAgent } from '@/hooks/useAgent';
import { useRecordGenealogy } from '@/hooks/useAmendmentGenealogy';
import { posthog } from '@/lib/posthog';
import { StudioProvider, useStudio } from '@/components/studio/StudioProvider';
import { StudioHeader } from '@/components/studio/StudioHeader';
import { StudioActionBar } from '@/components/studio/StudioActionBar';
import { StudioPanel } from '@/components/studio/StudioPanel';
import {
  CONSTITUTION_SLASH_PROMPTS,
  buildConstitutionEditorContext,
  injectInlineComment,
} from '@/components/studio/studioEditorHelpers';
import { ConstitutionEditor } from '@/components/workspace/editor/ConstitutionEditor';
import { ProposalEditor } from '@/components/workspace/editor/ProposalEditor';
import { AgentChatPanel } from '@/components/workspace/agent/AgentChatPanel';
import { AmendmentMetaStrip } from '@/components/workspace/author/AmendmentMetaStrip';
import { AmendmentIntelPanel } from '@/components/workspace/author/AmendmentIntelPanel';
import { IntentInputPanel } from '@/components/workspace/author/IntentInputPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { CONSTITUTION_NODES, CONSTITUTION_VERSION } from '@/lib/constitution/fullText';
import { extractAmendmentChanges, serializeAmendmentChanges } from '@/lib/constitution/utils';
import { proposeChange } from '@/components/workspace/editor/SuggestModePlugin';
import type { AmendmentChange } from '@/lib/constitution/types';
import type { AmendmentEditorMode } from '@/lib/workspace/editor/types';
import type { ProposedComment } from '@/lib/workspace/editor/types';
import type { ProposalField } from '@/lib/workspace/editor/types';
import type { Editor } from '@tiptap/core';
import type { ConstitutionSlashCommandType } from '@/components/workspace/editor/ConstitutionSlashCommands';

// ---------------------------------------------------------------------------
// AuthorPanelWrapper — thin wrapper that connects StudioPanel to StudioProvider
// ---------------------------------------------------------------------------

function AuthorPanelWrapper({
  agentContent,
  intelContent,
}: {
  agentContent: ReactNode;
  intelContent: ReactNode;
}) {
  const { panelOpen, activePanel, panelWidth, closePanel, togglePanel, setPanelWidth } =
    useStudio();

  return (
    <StudioPanel
      isOpen={panelOpen}
      onClose={closePanel}
      activeTab={activePanel}
      onTabChange={(tab) => togglePanel(tab)}
      width={panelWidth}
      onWidthChange={setPanelWidth}
      agentContent={agentContent}
      intelContent={intelContent}
    />
  );
}

// ---------------------------------------------------------------------------
// AuthorActionBarWrapper — connects action bar to studio context
// ---------------------------------------------------------------------------

function AuthorActionBarWrapper({
  statusInfo,
  contextActions,
}: {
  statusInfo: ReactNode;
  contextActions?: ReactNode;
}) {
  const { panelOpen, activePanel, togglePanel } = useStudio();

  return (
    <StudioActionBar
      activePanel={panelOpen ? activePanel : null}
      onPanelToggle={togglePanel}
      statusInfo={statusInfo}
      contextActions={contextActions}
    />
  );
}

// ---------------------------------------------------------------------------
// Main amendment editor page
// ---------------------------------------------------------------------------

function AmendmentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = typeof params.draftId === 'string' ? params.draftId : null;
  const { data, isLoading, error } = useDraft(draftId);

  const [mode] = useState<AmendmentEditorMode>('suggest');
  const [changes, setChanges] = useState<AmendmentChange[]>([]);
  const [showIntentPanel, setShowIntentPanel] = useState(searchParams.get('mode') === 'intent');
  const [intentGenerating, setIntentGenerating] = useState(false);
  const constitutionEditorRef = useRef<Editor | null>(null);
  const proposalEditorRef = useRef<Editor | null>(null);

  const { stakeAddress, segment } = useSegment();
  const updateDraft = useUpdateDraft(draftId ?? '');
  const recordGenealogy = useRecordGenealogy();

  // --- Derive user role from ownership + segment ---
  const draft = data?.draft ?? null;
  const isOwner = !!stakeAddress && draft?.ownerStakeAddress === stakeAddress;
  const userRole = isOwner
    ? ('proposer' as const)
    : segment === 'cc'
      ? ('cc_member' as const)
      : ('reviewer' as const);
  const readOnly = !isOwner;

  // --- Agent hook ---
  const {
    sendMessage: agentSendMessage,
    messages: agentMessages,
    isStreaming: agentIsStreaming,
    lastComment: agentLastComment,
    clearLastComment: agentClearLastComment,
    activeToolCall: agentActiveToolCall,
    error: agentError,
  } = useAgent({ proposalId: draftId ?? '', userRole });

  // --- Extract existing changes from draft type_specific on load ---
  const existingChanges = useMemo(
    () => extractAmendmentChanges(draft?.typeSpecific as Record<string, unknown> | null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft?.id],
  );

  // Sync initial changes to state
  useEffect(() => {
    if (existingChanges.length > 0 && changes.length === 0) {
      setChanges(existingChanges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingChanges]);

  // --- Content for ProposalEditor (title/abstract/motivation/rationale) ---
  const proposalContent = useMemo(
    () => ({
      title: draft?.title ?? '',
      abstract: draft?.abstract ?? '',
      motivation: draft?.motivation ?? '',
      rationale: draft?.rationale ?? '',
    }),
    [draft?.title, draft?.abstract, draft?.motivation, draft?.rationale],
  );

  // --- Constitution content for agent context ---
  const constitutionContent = useMemo(() => {
    const content: Record<string, string> = {};
    for (const node of CONSTITUTION_NODES) {
      content[node.id] = node.text;
    }
    return content;
  }, []);

  // --- Changes update handler (auto-save to draft type_specific) ---
  const handleChangesUpdate = useCallback(
    (newChanges: AmendmentChange[]) => {
      setChanges(newChanges);
      const typeSpecific = serializeAmendmentChanges(
        (draft?.typeSpecific as Record<string, unknown>) ?? null,
        newChanges,
      );
      updateDraft.mutate({ typeSpecific });
    },
    [draft?.typeSpecific, updateDraft],
  );

  // --- Proposal description content change (auto-save) ---
  const handleProposalContentChange = useCallback(
    (field: ProposalField, value: string) => {
      updateDraft.mutate({ [field]: value });
    },
    [updateDraft],
  );

  // --- Editor ready handlers ---
  const handleConstitutionEditorReady = useCallback((editor: Editor) => {
    constitutionEditorRef.current = editor;
  }, []);

  const handleProposalEditorReady = useCallback((editor: Editor) => {
    proposalEditorRef.current = editor;
  }, []);

  // --- Agent lastComment -> inject into constitution editor ---
  useEffect(() => {
    if (!agentLastComment || !constitutionEditorRef.current) return;
    injectInlineComment(constitutionEditorRef.current, agentLastComment);
    agentClearLastComment();
  }, [agentLastComment, agentClearLastComment]);

  // --- Slash command -> agent ---
  const handleSlashCommand = useCallback(
    (command: string, sectionContext: string) => {
      const prompt =
        CONSTITUTION_SLASH_PROMPTS[command as ConstitutionSlashCommandType]?.(sectionContext);
      if (!prompt) return;
      const ctx = buildConstitutionEditorContext(
        constitutionEditorRef.current,
        constitutionContent,
        mode,
      );
      agentSendMessage(prompt, ctx as Parameters<typeof agentSendMessage>[1]);
    },
    [agentSendMessage, constitutionContent, mode],
  );

  // --- Cmd+K -> agent ---
  const handleCommand = useCallback(
    (instruction: string, selectedText: string, section: string) => {
      let prompt = instruction;
      if (selectedText) {
        prompt = `Regarding the selected text in the ${section} section: "${selectedText}"\n\nInstruction: ${instruction}`;
      }
      const ctx = buildConstitutionEditorContext(
        constitutionEditorRef.current,
        constitutionContent,
        mode,
      );
      agentSendMessage(prompt, ctx as Parameters<typeof agentSendMessage>[1]);
    },
    [agentSendMessage, constitutionContent, mode],
  );

  // --- Chat panel: send message with editor context ---
  const handleChatSendMessage = useCallback(
    async (message: string) => {
      const ctx = buildConstitutionEditorContext(
        constitutionEditorRef.current,
        constitutionContent,
        mode,
      );
      posthog.capture('amendment_agent_message_sent', {
        proposal_id: draftId,
        mode,
        user_role: userRole,
        has_selection: !!ctx.selectedText,
      });
      await agentSendMessage(message, ctx as Parameters<typeof agentSendMessage>[1]);
    },
    [agentSendMessage, constitutionContent, mode, draftId, userRole],
  );

  // --- Apply proposed comment from chat panel ---
  const handleApplyComment = useCallback((comment: ProposedComment) => {
    if (!constitutionEditorRef.current) return;
    injectInlineComment(constitutionEditorRef.current, comment);
  }, []);

  // --- Diff accept/reject with genealogy ---
  const handleDiffAccept = useCallback(
    (editId: string) => {
      posthog.capture('amendment_change_accepted', {
        proposal_id: draftId,
        edit_id: editId,
      });
      if (draftId) {
        recordGenealogy.mutate({
          draftId,
          changeId: editId,
          action: 'accepted',
          sourceType: 'author',
        });
      }
    },
    [draftId, recordGenealogy],
  );

  const handleDiffReject = useCallback(
    (editId: string) => {
      posthog.capture('amendment_change_rejected', {
        proposal_id: draftId,
        edit_id: editId,
      });
      if (draftId) {
        recordGenealogy.mutate({
          draftId,
          changeId: editId,
          action: 'rejected',
          sourceType: 'author',
        });
      }
    },
    [draftId, recordGenealogy],
  );

  // --- Intent panel: amendments generated by AI ---
  const handleAmendmentsGenerated = useCallback(
    (
      generatedChanges: AmendmentChange[],
      metadata: { summary: string; motivation: string; rationale: string },
    ) => {
      setIntentGenerating(false);
      setShowIntentPanel(false);

      // Apply generated changes to the editor
      if (constitutionEditorRef.current) {
        for (const change of generatedChanges) {
          proposeChange(
            constitutionEditorRef.current,
            change.articleId,
            change.originalText,
            change.proposedText,
            change.explanation,
          );
        }
      }

      // Update draft with generated metadata
      const updates: Record<string, unknown> = {};
      if (metadata.motivation && !proposalContent.motivation) {
        updates.motivation = metadata.motivation;
      }
      if (metadata.rationale && !proposalContent.rationale) {
        updates.rationale = metadata.rationale;
      }
      if (Object.keys(updates).length > 0) {
        updateDraft.mutate(updates);
      }

      // Record genealogy for each generated change
      if (draftId) {
        for (const change of generatedChanges) {
          recordGenealogy.mutate({
            draftId,
            changeId: change.id,
            action: 'created',
            actionReason: metadata.summary,
            sourceType: 'ai',
          });
        }
      }
    },
    [draftId, proposalContent.motivation, proposalContent.rationale, updateDraft, recordGenealogy],
  );

  // --- Status info ---
  const changeCount = changes.length;
  const acceptedCount = changes.filter((c) => c.status === 'accepted').length;
  const rejectedCount = changes.filter((c) => c.status === 'rejected').length;

  const statusInfo = useMemo(
    () => (
      <AmendmentMetaStrip
        constitutionVersion={CONSTITUTION_VERSION}
        changeCount={changeCount}
        status={draft?.status ?? 'draft'}
        acceptedCount={acceptedCount}
        rejectedCount={rejectedCount}
      />
    ),
    [changeCount, draft?.status, acceptedCount, rejectedCount],
  );

  // --- Agent chat panel ---
  const agentChatNode = (
    <AgentChatPanel
      sendMessage={handleChatSendMessage}
      messages={agentMessages}
      isStreaming={agentIsStreaming}
      activeToolCall={agentActiveToolCall}
      error={agentError}
      onApplyComment={readOnly ? undefined : handleApplyComment}
    />
  );

  // --- Intel panel ---
  const intelNode = draftId ? <AmendmentIntelPanel draftId={draftId} changes={changes} /> : null;

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="h-12 border-t-2 border-teal-500 border-b border-b-border bg-background px-4 flex items-center shrink-0">
          <Skeleton className="h-5 w-24" />
          <div className="flex-1" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="flex-1 flex items-start justify-center pt-12">
          <div className="max-w-3xl w-full px-6 space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
        </div>
        <div className="h-12 border-t border-border bg-background shrink-0" />
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
            className="text-sm text-primary hover:underline cursor-pointer"
          >
            Back to Author
          </button>
        </div>
      </div>
    );
  }

  // --- Verify this is a NewConstitution draft ---
  if (draft.proposalType !== 'NewConstitution') {
    router.push(`/workspace/editor/${draftId}`);
    return null;
  }

  return (
    <>
      {/* Intent input panel overlay (Path B) */}
      {showIntentPanel && (
        <IntentInputPanel
          onAmendmentsGenerated={handleAmendmentsGenerated}
          isGenerating={intentGenerating}
          onCancel={() => setShowIntentPanel(false)}
        />
      )}

      <StudioProvider>
        <div className="flex flex-col h-screen">
          {/* Studio Header */}
          <StudioHeader
            backLabel="Back to drafts"
            backHref="/workspace/author"
            title={draft.title || 'Constitutional Amendment'}
            proposalType="New Constitution"
          />

          {/* Main content area */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Main editor area (scrollable) */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              {/* Constitution editor (takes most of the space) */}
              <ConstitutionEditor
                constitutionNodes={CONSTITUTION_NODES}
                existingChanges={existingChanges}
                mode={mode}
                readOnly={readOnly}
                onChangesUpdate={readOnly ? undefined : handleChangesUpdate}
                onEditorReady={handleConstitutionEditorReady}
                onSlashCommand={handleSlashCommand}
                onCommand={handleCommand}
                onDiffAccept={handleDiffAccept}
                onDiffReject={handleDiffReject}
                currentUserId={stakeAddress ?? 'anonymous'}
              />

              {/* Proposal description section (below the constitution editor) */}
              <div className="lg:ml-56 max-w-3xl mx-auto px-6 pb-6">
                <div className="border-t border-border mt-6 pt-6">
                  <h3 className="text-sm font-semibold mb-1">Proposal Description</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Describe why this amendment is needed. This becomes the CIP-108 metadata
                    submitted on-chain.
                  </p>
                  <ProposalEditor
                    content={proposalContent}
                    mode="edit"
                    readOnly={readOnly}
                    onContentChange={readOnly ? undefined : handleProposalContentChange}
                    currentUserId={stakeAddress ?? 'anonymous'}
                    onEditorReady={handleProposalEditorReady}
                  />
                </div>
              </div>
            </div>

            {/* Studio Panel (on-demand right panel) */}
            <AuthorPanelWrapper agentContent={agentChatNode} intelContent={intelNode} />
          </div>

          {/* Studio Action Bar */}
          <AuthorActionBarWrapper statusInfo={statusInfo} />
        </div>
      </StudioProvider>
    </>
  );
}

export default function AmendmentEditorRoute() {
  return <AmendmentEditorPage />;
}
