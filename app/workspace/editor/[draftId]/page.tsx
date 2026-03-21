'use client';

export const dynamic = 'force-dynamic';

/**
 * Workspace Editor — Tiptap-based proposal workspace using Studio shell.
 *
 * Uses StudioProvider + StudioHeader/StudioPanel/StudioActionBar for the
 * author experience. Replaces the old WorkspaceEmbed fullscreen overlay.
 *
 * Page-specific overlays:
 * - RevisionJustificationFlow (proposer saves a new version)
 */

import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { useSaveStatus } from '@/lib/workspace/save-status';
import { useParams, useRouter } from 'next/navigation';
import { useSyncEntityToURL } from '@/hooks/useSyncEntityToURL';
import { useDraft, useUpdateDraft } from '@/hooks/useDrafts';
import { useQuery } from '@tanstack/react-query';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useAgent } from '@/hooks/useAgent';
import { useFeedbackThemes } from '@/hooks/useFeedbackThemes';
import { posthog } from '@/lib/posthog';
import { StudioProvider, useStudio } from '@/components/studio/StudioProvider';
import { StudioHeader } from '@/components/studio/StudioHeader';
import { StudioActionBar } from '@/components/studio/StudioActionBar';
import { StudioPanel } from '@/components/studio/StudioPanel';
import {
  SLASH_COMMAND_PROMPTS,
  buildEditorContext,
  injectInlineComment,
} from '@/components/studio/studioEditorHelpers';
import { WorkspacePanels } from '@/components/workspace/layout/WorkspacePanels';
import { ProposalEditor, injectProposedEdit } from '@/components/workspace/editor/ProposalEditor';
import { AgentChatPanel } from '@/components/workspace/agent/AgentChatPanel';
import { StatusBar } from '@/components/workspace/layout/StatusBar';
import { SaveErrorBanner } from '@/components/workspace/layout/SaveErrorBanner';
import { RevisionJustificationFlow } from '@/components/workspace/editor/RevisionJustificationFlow';
import { ReadinessPanel } from '@/components/workspace/author/ReadinessPanel';
import { ProposalAlignmentCard } from '@/components/intelligence/ProposalAlignmentCard';
import { Skeleton } from '@/components/ui/skeleton';
import { PROPOSAL_TYPE_LABELS } from '@/lib/workspace/types';
import type { ProposalType } from '@/lib/workspace/types';
import type {
  EditorMode,
  ProposalField,
  ProposedEdit,
  ProposedComment,
  SlashCommandType,
} from '@/lib/workspace/editor/types';
import type { Editor } from '@tiptap/core';

// ---------------------------------------------------------------------------
// LineageBanner — shows "Based on: [title]" if this draft supersedes another
// ---------------------------------------------------------------------------

function LineageBanner({ supersedesId }: { supersedesId: string }) {
  const { data, isLoading } = useQuery<{ draft: { title: string; status: string } }>({
    queryKey: ['author-draft-lineage', supersedesId],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      try {
        const { getStoredSession } = await import('@/lib/supabaseAuth');
        const token = getStoredSession();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch {
        // No session
      }
      const res = await fetch(`/api/workspace/drafts/${encodeURIComponent(supersedesId)}`, {
        headers,
      });
      if (!res.ok) throw new Error('Source draft not found');
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading) return null;

  const sourceTitle = data?.draft?.title;
  const sourceStatus = data?.draft?.status;

  return (
    <div className="border-l-2 border-teal-500/60 pl-3 py-1.5 mb-4">
      <p className="text-xs text-muted-foreground">
        <span className="mr-1">{'\u21A9'}</span>
        Based on:{' '}
        {sourceTitle ? (
          <>
            <a
              href={`/workspace/author/${supersedesId}`}
              className="text-teal-400 hover:text-teal-300 underline underline-offset-2"
            >
              {sourceTitle}
            </a>
            {sourceStatus && (
              <span className="ml-1.5 text-muted-foreground/70">
                ({sourceStatus.replace(/_/g, ' ')})
              </span>
            )}
          </>
        ) : (
          <span className="italic">a previous draft</span>
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuthorPanelWrapper — thin wrapper that connects StudioPanel to StudioProvider
// ---------------------------------------------------------------------------

function AuthorPanelWrapper({
  agentContent,
  readinessContent,
}: {
  agentContent: ReactNode;
  readinessContent?: ReactNode;
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
      readinessContent={readinessContent}
    />
  );
}

// ---------------------------------------------------------------------------
// AuthorHeaderWrapper — connects readiness badge click to panel toggle
// ---------------------------------------------------------------------------

function AuthorHeaderWrapper(
  props: React.ComponentProps<typeof StudioHeader> & {
    readiness?: { level: 'low' | 'moderate' | 'high' | 'strong'; blockerCount: number };
  },
) {
  const { togglePanel } = useStudio();

  return <StudioHeader {...props} onReadinessClick={() => togglePanel('readiness')} />;
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
// Main workspace page
// ---------------------------------------------------------------------------

function WorkspaceEditorPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = typeof params.draftId === 'string' ? params.draftId : null;

  // Sync draftId to workspace store for cross-component access
  useSyncEntityToURL();
  const { data, isLoading, error } = useDraft(draftId);

  const [showJustificationFlow, setShowJustificationFlow] = useState(false);
  const [mode, setModeRaw] = useState<EditorMode>('edit');
  const editorRef = useRef<Editor | null>(null);

  const { stakeAddress, segment } = useSegment();

  const updateDraft = useUpdateDraft(draftId ?? '');
  const { setSaving } = useSaveStatus();

  // --- Debounced auto-save: show "Saving..." immediately but delay the mutation ---
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // --- Mode change with analytics ---
  const setMode = useCallback(
    (next: EditorMode) => {
      posthog.capture('workspace_mode_changed', { proposal_id: draftId, mode: next });
      setModeRaw(next);
    },
    [draftId],
  );

  // --- Derive user role from ownership + segment ---
  const draft = data?.draft ?? null;
  const isOwner = !!stakeAddress && draft?.ownerStakeAddress === stakeAddress;
  const userRole = isOwner
    ? ('proposer' as const)
    : segment === 'cc'
      ? ('cc_member' as const)
      : ('reviewer' as const);
  const readOnly = !isOwner;

  // Set initial mode based on readOnly
  useEffect(() => {
    if (readOnly) {
      setModeRaw('review');
    }
  }, [readOnly]);

  // --- Agent hook (lifted to page level so slash commands + Cmd+K can call it) ---
  const {
    sendMessage: agentSendMessage,
    messages: agentMessages,
    isStreaming: agentIsStreaming,
    lastEdit: agentLastEdit,
    lastComment: agentLastComment,
    clearLastEdit: agentClearLastEdit,
    clearLastComment: agentClearLastComment,
    activeToolCall: agentActiveToolCall,
    error: agentError,
  } = useAgent({ proposalId: draftId ?? '', userRole });

  // --- Readiness badge for header (lightweight, no extra queries) ---
  const readinessBadge = useMemo(() => {
    if (!draft || !isOwner) return undefined;
    const fields = [draft.title, draft.abstract, draft.motivation, draft.rationale];
    const filled = fields.filter((f) => f && f.trim().length > 0).length;
    const constCheck = draft.lastConstitutionalCheck?.score ?? null;
    let blockerCount = 0;
    if (filled < 4) blockerCount++;
    if (constCheck === 'fail') blockerCount++;
    const level =
      blockerCount > 0
        ? ('low' as const)
        : constCheck === 'pass' && filled >= 4
          ? ('strong' as const)
          : ('moderate' as const);
    return { level, blockerCount };
  }, [draft, isOwner]);

  // --- Derived version data ---
  const versions = data?.versions ?? null;
  const submittedTxHash = draft?.submittedTxHash ?? null;

  // --- Feedback themes (for justification flow) ---
  const { themes: feedbackThemes } = useFeedbackThemes(submittedTxHash, submittedTxHash ? 0 : null);

  // --- Content ---
  const content = useMemo(
    () => ({
      title: draft?.title ?? '',
      abstract: draft?.abstract ?? '',
      motivation: draft?.motivation ?? '',
      rationale: draft?.rationale ?? '',
    }),
    [draft?.title, draft?.abstract, draft?.motivation, draft?.rationale],
  );

  // --- Content change handler (auto-save with debounce) ---
  const handleContentChange = useCallback(
    (field: ProposalField, value: string) => {
      // Show "Saving..." immediately for responsiveness
      setSaving();
      // Debounce the actual mutation to avoid flooding during fast typing
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateDraft.mutate({ [field]: value });
      }, 500);
    },
    [updateDraft, setSaving],
  );

  // --- Retry save: re-send current content to mutation ---
  const handleSaveRetry = useCallback(() => {
    if (!draft) return;
    setSaving();
    updateDraft.mutate({
      title: draft.title,
      abstract: draft.abstract,
      motivation: draft.motivation,
      rationale: draft.rationale,
    });
  }, [draft, updateDraft, setSaving]);

  // --- Capture editor instance ---
  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  // --- Agent lastEdit -> inject into editor ---
  useEffect(() => {
    if (!agentLastEdit || !editorRef.current) return;
    injectProposedEdit(editorRef.current, agentLastEdit);
    agentClearLastEdit();
  }, [agentLastEdit, agentClearLastEdit]);

  // --- Agent lastComment -> apply inline comment ---
  useEffect(() => {
    if (!agentLastComment || !editorRef.current) return;
    injectInlineComment(editorRef.current, agentLastComment);
    agentClearLastComment();
  }, [agentLastComment, agentClearLastComment]);

  // --- Slash command -> agent ---
  const handleSlashCommand = useCallback(
    (command: SlashCommandType, sectionContext: string) => {
      const prompt = SLASH_COMMAND_PROMPTS[command]?.(sectionContext);
      if (!prompt) return;
      const ctx = buildEditorContext(editorRef.current, content, mode);
      agentSendMessage(prompt, ctx);
    },
    [agentSendMessage, content, mode],
  );

  // --- Cmd+K -> agent ---
  const handleCommand = useCallback(
    (instruction: string, selectedText: string, section: string) => {
      let prompt = instruction;
      if (selectedText) {
        prompt = `Regarding the selected text in the ${section} section: "${selectedText}"\n\nInstruction: ${instruction}`;
      }
      const ctx = buildEditorContext(editorRef.current, content, mode);
      agentSendMessage(prompt, ctx);
    },
    [agentSendMessage, content, mode],
  );

  // --- Chat panel: send message with editor context ---
  const handleChatSendMessage = useCallback(
    async (message: string) => {
      const ctx = buildEditorContext(editorRef.current, content, mode);
      posthog.capture('workspace_agent_message_sent', {
        proposal_id: draftId,
        mode,
        user_role: userRole,
        has_selection: !!ctx.selectedText,
      });
      await agentSendMessage(message, ctx);
    },
    [agentSendMessage, content, mode, draftId, userRole],
  );

  // --- Apply proposed edit from chat panel ---
  const handleApplyEdit = useCallback((edit: ProposedEdit) => {
    if (!editorRef.current) return;
    injectProposedEdit(editorRef.current, edit);
  }, []);

  // --- Apply proposed comment from chat panel ---
  const handleApplyComment = useCallback((comment: ProposedComment) => {
    if (!editorRef.current) return;
    injectInlineComment(editorRef.current, comment);
  }, []);

  // --- Type label ---
  const typeLabel = draft
    ? (PROPOSAL_TYPE_LABELS[draft.proposalType as ProposalType] ?? draft.proposalType)
    : '';

  // --- Status bar data ---
  const feedbackThemeCount = feedbackThemes.length;
  const draftStatus = draft?.status;

  const statusBarNode = useMemo(() => {
    const completenessChecks = [
      !!content.title,
      !!content.abstract,
      !!content.motivation,
      !!content.rationale,
      content.title.length > 10,
      content.abstract.length > 50,
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
        showSaveStatus
      />
    );
  }, [content, draftStatus, feedbackThemeCount]);

  // --- Save Version button ---
  const saveVersionButton = isOwner ? (
    <button
      onClick={() => setShowJustificationFlow(true)}
      className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
    >
      Save Version
    </button>
  ) : undefined;

  // --- Agent chat panel (rendered once, passed to panel wrapper) ---
  const agentChatNode = (
    <AgentChatPanel
      sendMessage={handleChatSendMessage}
      messages={agentMessages}
      isStreaming={agentIsStreaming}
      activeToolCall={agentActiveToolCall}
      error={agentError}
      onApplyEdit={readOnly ? undefined : handleApplyEdit}
      onApplyComment={handleApplyComment}
    />
  );

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

      <StudioProvider>
        <WorkspacePanels
          layoutId="editor"
          toolbar={
            <AuthorHeaderWrapper
              backLabel="Back to drafts"
              backHref="/workspace/author"
              title={draft.title || 'Untitled proposal'}
              titleTransitionName={draftId ? `draft-title-${draftId}` : undefined}
              proposalType={typeLabel}
              showModeSwitch={isOwner}
              mode={mode}
              onModeChange={isOwner ? setMode : undefined}
              actions={saveVersionButton}
              readiness={readinessBadge}
            />
          }
          main={
            <div className="max-w-3xl mx-auto px-6 py-6 transition-opacity duration-150">
              {draft.supersedesId && <LineageBanner supersedesId={draft.supersedesId} />}
              <SaveErrorBanner onRetry={handleSaveRetry} />
              <ProposalEditor
                content={content}
                mode={mode}
                readOnly={readOnly || mode === 'review'}
                onContentChange={readOnly ? undefined : handleContentChange}
                onSlashCommand={handleSlashCommand}
                onCommand={handleCommand}
                onDiffAccept={(editId) => {
                  posthog.capture('workspace_inline_edit_accepted', {
                    proposal_id: draftId,
                    edit_id: editId,
                  });
                }}
                onDiffReject={(editId) => {
                  posthog.capture('workspace_inline_edit_rejected', {
                    proposal_id: draftId,
                    edit_id: editId,
                  });
                }}
                currentUserId={stakeAddress ?? 'anonymous'}
                onEditorReady={handleEditorReady}
              />
            </div>
          }
          context={
            <AuthorPanelWrapper
              agentContent={agentChatNode}
              readinessContent={
                draftId ? (
                  <>
                    <ReadinessPanel draftId={draftId} />
                    <ProposalAlignmentCard className="mt-4" />
                  </>
                ) : undefined
              }
            />
          }
          statusBar={<AuthorActionBarWrapper statusInfo={statusBarNode} />}
        />
      </StudioProvider>
    </>
  );
}

export default function WorkspaceEditorRoute() {
  return <WorkspaceEditorPage />;
}
