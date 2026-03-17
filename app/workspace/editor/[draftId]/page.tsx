'use client';

export const dynamic = 'force-dynamic';

/**
 * Workspace Editor — Tiptap-based proposal workspace.
 *
 * Phase 2 integration:
 * - AgentChatPanel wired to useAgent hook
 * - Editor slash commands + Cmd+K -> agent.sendMessage
 * - Agent lastEdit -> editor injectProposedEdit
 * - Agent lastComment -> inline comment injection
 * - Mode switcher: 'diff' mode renders RevisionDiffView
 * - StatusBar wired to real proposal data
 * - FeedbackStream available in chat panel tabs (proposer view)
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDraft, useUpdateDraft } from '@/hooks/useDrafts';
import { useAgent } from '@/hooks/useAgent';
import { useRevisionState } from '@/hooks/useRevision';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useFeedbackThemes } from '@/hooks/useFeedbackThemes';
import { posthog } from '@/lib/posthog';
import { WorkspaceLayout } from '@/components/workspace/layout/WorkspaceLayout';
import { WorkspaceToolbar } from '@/components/workspace/layout/WorkspaceToolbar';
import { StatusBar } from '@/components/workspace/layout/StatusBar';
import { ProposalEditor, injectProposedEdit } from '@/components/workspace/editor/ProposalEditor';
import { AgentChatPanel } from '@/components/workspace/agent/AgentChatPanel';
import { RevisionDiffView } from '@/components/workspace/editor/RevisionDiffView';
import { RevisionJustificationFlow } from '@/components/workspace/editor/RevisionJustificationFlow';
import { FeedbackStream } from '@/components/workspace/feedback/FeedbackStream';
import { EndorsementPrompt } from '@/components/workspace/feedback/EndorsementPrompt';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PROPOSAL_TYPE_LABELS } from '@/lib/workspace/types';
import type { DraftContent } from '@/lib/workspace/types';
import type { FeedbackTheme } from '@/lib/workspace/feedback/types';
import type {
  EditorMode,
  EditorContext,
  ProposalField,
  ProposedEdit,
  ProposedComment,
  SlashCommandType,
} from '@/lib/workspace/editor/types';
import type { Editor } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Slash command -> agent prompt mapping
// ---------------------------------------------------------------------------

const SLASH_COMMAND_PROMPTS: Record<SlashCommandType, (section: string) => string> = {
  improve: (section) =>
    `Please suggest improvements to the ${section} section of my proposal. Focus on clarity, persuasiveness, and completeness.`,
  'check-constitution': (section) =>
    `Check the ${section} section for constitutional alignment. Flag any potential issues with the Cardano Constitution.`,
  'similar-proposals': (_section) =>
    `Search for similar governance proposals that have been submitted before. Show me precedents and their outcomes.`,
  complete: (section) =>
    `Continue writing the ${section} section from where I left off. Match the existing tone and style.`,
  draft: (section) =>
    `Draft content for the ${section} section based on the other sections and the proposal type.`,
};

// ---------------------------------------------------------------------------
// Simple overlap check (client-side, no AI)
// ---------------------------------------------------------------------------

function findOverlappingTheme(commentText: string, themes: FeedbackTheme[]): FeedbackTheme | null {
  if (!commentText || themes.length === 0) return null;
  const words = commentText
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  if (words.length === 0) return null;

  let bestTheme: FeedbackTheme | null = null;
  let bestScore = 0;

  for (const theme of themes) {
    const summary = theme.summary.toLowerCase();
    const matches = words.filter((w) => summary.includes(w)).length;
    const score = matches / words.length;
    if (score > bestScore && score >= 0.3) {
      bestScore = score;
      bestTheme = theme;
    }
  }

  return bestTheme;
}

// ---------------------------------------------------------------------------
// EditorContext builder
// ---------------------------------------------------------------------------

function buildEditorContext(
  editor: Editor | null,
  draftContent: { title: string; abstract: string; motivation: string; rationale: string },
  mode: EditorMode,
): EditorContext {
  let selectedText: string | undefined;
  let cursorSection: ProposalField | undefined;

  if (editor) {
    const { from, to, empty } = editor.state.selection;
    if (!empty) {
      selectedText = editor.state.doc.textBetween(from, to, '\n');
    }

    // Determine which section the cursor is in by walking up the document
    const resolvedPos = editor.state.doc.resolve(from);
    for (let depth = resolvedPos.depth; depth >= 0; depth--) {
      const node = resolvedPos.node(depth);
      if (node.type.name === 'sectionBlock' && node.attrs.field) {
        cursorSection = node.attrs.field as ProposalField;
        break;
      }
    }
  }

  return {
    selectedText,
    cursorSection,
    currentContent: {
      title: draftContent.title,
      abstract: draftContent.abstract,
      motivation: draftContent.motivation,
      rationale: draftContent.rationale,
    },
    mode,
  };
}

// ---------------------------------------------------------------------------
// Comment injection helper
// ---------------------------------------------------------------------------

function injectInlineComment(editor: Editor, comment: ProposedComment): void {
  const { doc } = editor.state;
  let sectionStart = 0;
  let found = false;

  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === 'sectionBlock' && node.attrs.field === comment.field) {
      sectionStart = pos + 1; // +1 to get inside the section block
      found = true;
      return false;
    }
  });

  if (found) {
    const from = sectionStart + comment.anchorStart;
    const to = sectionStart + comment.anchorEnd;

    // Verify the range is valid
    if (from >= 0 && to <= doc.content.size && from < to) {
      const commentId = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      editor
        .chain()
        .focus()
        .setMark('inlineComment', {
          id: commentId,
          author: 'Agent',
          authorId: 'agent',
          timestamp: new Date().toISOString(),
          category: comment.category,
          text: comment.commentText,
        })
        .setTextSelection({ from, to })
        .run();
    }
  }
}

// ---------------------------------------------------------------------------
// Main workspace page
// ---------------------------------------------------------------------------

function WorkspaceEditorPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = typeof params.draftId === 'string' ? params.draftId : null;
  const { data, isLoading, error } = useDraft(draftId);

  const [mode, setModeRaw] = useState<EditorMode>('edit');
  const setMode = useCallback(
    (next: EditorMode) => {
      if (next === 'diff') {
        posthog.capture('workspace_revision_diff_opened', { draft_id: draftId });
      }
      setModeRaw(next);
    },
    [draftId],
  );
  const editorRef = useRef<Editor | null>(null);
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
  const _isReadOnly = !isOwner;

  // --- Agent hook ---
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
  } = useAgent({
    proposalId: draftId ?? '',
    userRole,
  });

  // --- Revision state (for diff mode) ---
  const revisionQuery = useRevisionState(draftId);
  const revisionState = revisionQuery.data?.state ?? null;

  // --- Derived version data ---
  const versions = data?.versions ?? null;
  const submittedTxHash = draft?.submittedTxHash ?? null;

  // --- Feedback themes (for proposer tab + endorsement prompt) ---
  const { themes: feedbackThemes } = useFeedbackThemes(submittedTxHash, submittedTxHash ? 0 : null);

  // --- Endorsement prompt state ---
  const [endorsementPrompt, setEndorsementPrompt] = useState<{
    theme: FeedbackTheme;
    annotationText: string;
  } | null>(null);

  // --- Content change handler (auto-save) ---
  const handleContentChange = useCallback(
    (field: ProposalField, content: string) => {
      updateDraft.mutate({ [field]: content });
    },
    [updateDraft],
  );

  // --- Capture editor instance ---
  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  // --- Slash command -> agent ---
  const handleSlashCommand = useCallback(
    (command: SlashCommandType, sectionContext: string) => {
      const prompt = SLASH_COMMAND_PROMPTS[command]?.(sectionContext);
      if (!prompt || !draft) return;

      const ctx = buildEditorContext(editorRef.current, draft, mode);
      agentSendMessage(prompt, ctx);
    },
    [agentSendMessage, draft, mode],
  );

  // --- Cmd+K -> agent ---
  const handleCommand = useCallback(
    (instruction: string, selectedText: string, section: string) => {
      if (!draft) return;

      let prompt = instruction;
      if (selectedText) {
        prompt = `Regarding the selected text in the ${section} section: "${selectedText}"\n\nInstruction: ${instruction}`;
      }

      const ctx = buildEditorContext(editorRef.current, draft, mode);
      agentSendMessage(prompt, ctx);
    },
    [agentSendMessage, draft, mode],
  );

  // --- Agent lastEdit -> inject into editor ---
  useEffect(() => {
    if (!agentLastEdit || !editorRef.current) return;
    injectProposedEdit(editorRef.current, agentLastEdit);
    agentClearLastEdit();
  }, [agentLastEdit, agentClearLastEdit]);

  // --- Agent lastComment -> apply inline comment + check for endorsement overlap ---
  useEffect(() => {
    if (!agentLastComment || !editorRef.current) return;
    injectInlineComment(editorRef.current, agentLastComment);

    // Check if this comment overlaps an existing feedback theme (reviewer only)
    if (!isOwner && feedbackThemes.length > 0) {
      const overlapping = findOverlappingTheme(agentLastComment.commentText, feedbackThemes);
      if (overlapping) {
        setEndorsementPrompt({
          theme: overlapping,
          annotationText: agentLastComment.commentText,
        });
      }
    }

    agentClearLastComment();
  }, [agentLastComment, agentClearLastComment, isOwner, feedbackThemes]);

  // --- Chat panel: send message with editor context ---
  const handleChatSendMessage = useCallback(
    async (message: string) => {
      if (!draft) return;
      const ctx = buildEditorContext(editorRef.current, draft, mode);
      posthog.capture('workspace_agent_message_sent', {
        draft_id: draftId,
        mode,
        has_selection: !!ctx.selectedText,
      });
      await agentSendMessage(message, ctx);
    },
    [agentSendMessage, draft, mode, draftId],
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

  // --- Status bar data ---
  const draftStatus = draft?.status;
  const draftTitle = draft?.title ?? '';
  const draftAbstract = draft?.abstract ?? '';
  const draftMotivation = draft?.motivation ?? '';
  const draftRationale = draft?.rationale ?? '';
  const feedbackThemeCount = feedbackThemes.length;

  const statusBarData = useMemo(() => {
    const completenessChecks = [
      !!draftTitle,
      !!draftAbstract,
      !!draftMotivation,
      !!draftRationale,
      draftTitle.length > 10,
      draftAbstract.length > 50,
    ];
    const done = completenessChecks.filter(Boolean).length;

    return {
      completeness: { done, total: completenessChecks.length },
      community: {
        reviewerCount: 0,
        themeCount: feedbackThemeCount,
      },
      userStatus: draftStatus === 'draft' ? 'Draft' : (draftStatus?.replace(/_/g, ' ') ?? 'Draft'),
    };
  }, [draftTitle, draftAbstract, draftMotivation, draftRationale, draftStatus, feedbackThemeCount]);

  // --- Version data for diff mode ---
  const diffData = useMemo(() => {
    if (!revisionState?.previousVersion || !draft) return null;

    // Build old content from the changed sections
    const oldContent: DraftContent = {
      title: draft.title,
      abstract: draft.abstract,
      motivation: draft.motivation,
      rationale: draft.rationale,
      proposalType: draft.proposalType,
    };

    // Apply old text for changed sections
    for (const change of revisionState.changedSections) {
      const field = change.field as keyof DraftContent;
      if (field in oldContent && field !== 'proposalType' && field !== 'typeSpecific') {
        oldContent[field] = change.oldText;
      }
    }

    return {
      oldContent,
      newContent: {
        title: draft.title,
        abstract: draft.abstract,
        motivation: draft.motivation,
        rationale: draft.rationale,
        proposalType: draft.proposalType,
      } as DraftContent,
      justifications: revisionState.justifications,
      oldVersionName: revisionState.previousVersion.versionName,
      newVersionName: revisionState.latestVersion.versionName,
    };
  }, [revisionState, draft]);

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

  const typeLabel = PROPOSAL_TYPE_LABELS[draft.proposalType] ?? draft.proposalType;

  // --- Diff mode: render RevisionDiffView instead of editor ---
  const renderEditor = () => {
    if (mode === 'diff' && diffData) {
      return (
        <div className="p-6 max-w-3xl mx-auto">
          <RevisionDiffView
            oldContent={diffData.oldContent}
            newContent={diffData.newContent}
            justifications={diffData.justifications}
            oldVersionName={diffData.oldVersionName}
            newVersionName={diffData.newVersionName}
          />
        </div>
      );
    }

    return (
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
        onSlashCommand={handleSlashCommand}
        onCommand={handleCommand}
        onDiffAccept={(editId) => {
          posthog.capture('workspace_inline_edit_accepted', {
            draft_id: draftId,
            edit_id: editId,
          });
        }}
        onDiffReject={(editId) => {
          posthog.capture('workspace_inline_edit_rejected', {
            draft_id: draftId,
            edit_id: editId,
          });
        }}
        currentUserId={stakeAddress ?? 'anonymous'}
        onEditorReady={handleEditorReady}
      />
    );
  };

  // --- Chat panel with optional feedback tab ---
  const hasSubmitted = !!draft.submittedTxHash;

  const renderChatPanel = () => {
    if (hasSubmitted) {
      // Proposer with submitted proposal: show chat + feedback tabs
      return (
        <Tabs defaultValue="chat" className="flex flex-col h-full">
          <TabsList variant="line" className="px-3 pt-2 shrink-0">
            <TabsTrigger value="chat" className="text-xs">
              Agent
            </TabsTrigger>
            <TabsTrigger value="feedback" className="text-xs">
              Feedback
              {feedbackThemeCount > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({feedbackThemeCount})
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="flex-1 min-h-0">
            <AgentChatPanel
              sendMessage={handleChatSendMessage}
              messages={agentMessages}
              isStreaming={agentIsStreaming}
              activeToolCall={agentActiveToolCall}
              error={agentError}
              onApplyEdit={handleApplyEdit}
              onApplyComment={handleApplyComment}
            />
          </TabsContent>
          <TabsContent value="feedback" className="flex-1 min-h-0 overflow-y-auto p-4">
            <FeedbackStream
              proposalTxHash={draft.submittedTxHash!}
              proposalIndex={0}
              isProposer={true}
            />
          </TabsContent>
        </Tabs>
      );
    }

    // Default: just the chat panel
    return (
      <AgentChatPanel
        sendMessage={handleChatSendMessage}
        messages={agentMessages}
        isStreaming={agentIsStreaming}
        activeToolCall={agentActiveToolCall}
        error={agentError}
        onApplyEdit={handleApplyEdit}
        onApplyComment={handleApplyComment}
      />
    );
  };

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

      {/* Endorsement prompt — shown when a reviewer's comment overlaps an existing theme */}
      {endorsementPrompt && submittedTxHash && (
        <div className="fixed inset-x-0 bottom-20 z-50 mx-auto max-w-lg px-4">
          <EndorsementPrompt
            theme={endorsementPrompt.theme}
            annotationText={endorsementPrompt.annotationText}
            proposalTxHash={submittedTxHash}
            proposalIndex={0}
            onEndorse={() => setEndorsementPrompt(null)}
            onAddNew={() => setEndorsementPrompt(null)}
            onCancel={() => setEndorsementPrompt(null)}
          />
        </div>
      )}

      <WorkspaceLayout
        toolbar={
          <div className="flex items-center">
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
            {isOwner && (
              <button
                onClick={() => setShowJustificationFlow(true)}
                className="mr-4 shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Save Version
              </button>
            )}
          </div>
        }
        editor={renderEditor()}
        chat={renderChatPanel()}
        statusBar={
          <StatusBar
            completeness={statusBarData.completeness}
            community={statusBarData.community}
            userStatus={statusBarData.userStatus}
          />
        }
      />
    </>
  );
}

export default function WorkspaceEditorRoute() {
  return <WorkspaceEditorPage />;
}
