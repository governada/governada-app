'use client';

/**
 * WorkspaceEmbed — reusable Tiptap workspace (editor + agent chat + status bar).
 *
 * Accepts proposal content directly via props so it can be used for:
 * - Author workspace (editable draft from useDraft hook)
 * - Review workspace (read-only on-chain proposal from ReviewQueueItem)
 *
 * The parent controls data fetching; this component is purely presentational + agent.
 */

import { useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { useAgent } from '@/hooks/useAgent';
import { useSegment } from '@/components/providers/SegmentProvider';
import { posthog } from '@/lib/posthog';
import { WorkspaceLayout } from '@/components/workspace/layout/WorkspaceLayout';
import { WorkspaceToolbar } from '@/components/workspace/layout/WorkspaceToolbar';
import { StatusBar } from '@/components/workspace/layout/StatusBar';
import { ProposalEditor, injectProposedEdit } from '@/components/workspace/editor/ProposalEditor';
import { AgentChatPanel } from '@/components/workspace/agent/AgentChatPanel';
import { PROPOSAL_TYPE_LABELS } from '@/lib/workspace/types';
import type { ProposalType } from '@/lib/workspace/types';
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
// Props
// ---------------------------------------------------------------------------

export interface WorkspaceEmbedProps {
  /** Unique ID for this proposal (draftId or txHash) */
  proposalId: string;
  /** Proposal content to render in the editor */
  content: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
  /** Governance action type */
  proposalType: string;
  /** Role determines agent behavior and editor editability */
  userRole: 'proposer' | 'reviewer' | 'cc_member';
  /** Whether the editor is read-only (default: false) */
  readOnly?: boolean;
  /** Called when content changes (only fires when readOnly=false) */
  onContentChange?: (field: ProposalField, content: string) => void;
  /** Optional toolbar actions (e.g. "Save Version" button) rendered after the mode switcher */
  toolbarActions?: ReactNode;
  /** Optional content rendered below the editor (e.g. ReviewActionZone) */
  belowEditor?: ReactNode;
  /** Optional extra tab(s) in the chat panel area (e.g. feedback stream) */
  chatTabs?: ReactNode;
  /** Override status bar — if not provided, a default one is computed from content */
  statusBar?: ReactNode;
  /** Whether to show the toolbar mode switcher (default: true) */
  showModeSwitch?: boolean;
  /** Back link URL for the toolbar (default: /workspace/author) */
  backUrl?: string;
  /** Override root layout class (e.g. "h-full" when embedded in another layout) */
  layoutClassName?: string;
}

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
      sectionStart = pos + 1;
      found = true;
      return false;
    }
  });

  if (found) {
    const from = sectionStart + comment.anchorStart;
    const to = sectionStart + comment.anchorEnd;

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
// Component
// ---------------------------------------------------------------------------

export function WorkspaceEmbed({
  proposalId,
  content,
  proposalType,
  userRole,
  readOnly = false,
  onContentChange,
  toolbarActions,
  belowEditor,
  chatTabs,
  statusBar: statusBarOverride,
  showModeSwitch = true,
  backUrl: _backUrl,
  layoutClassName,
}: WorkspaceEmbedProps) {
  const [mode, setModeRaw] = useState<EditorMode>(readOnly ? 'review' : 'edit');
  const setMode = useCallback(
    (next: EditorMode) => {
      posthog.capture('workspace_mode_changed', { proposal_id: proposalId, mode: next });
      setModeRaw(next);
    },
    [proposalId],
  );
  const editorRef = useRef<Editor | null>(null);
  const { stakeAddress } = useSegment();

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
    proposalId,
    userRole,
  });

  // --- Content change handler ---
  const handleContentChange = useCallback(
    (field: ProposalField, value: string) => {
      if (!readOnly && onContentChange) {
        onContentChange(field, value);
      }
    },
    [readOnly, onContentChange],
  );

  // --- Capture editor instance ---
  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

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

  // --- Chat panel: send message with editor context ---
  const handleChatSendMessage = useCallback(
    async (message: string) => {
      const ctx = buildEditorContext(editorRef.current, content, mode);
      posthog.capture('workspace_agent_message_sent', {
        proposal_id: proposalId,
        mode,
        user_role: userRole,
        has_selection: !!ctx.selectedText,
      });
      await agentSendMessage(message, ctx);
    },
    [agentSendMessage, content, mode, proposalId, userRole],
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

  // --- Default status bar data ---
  const defaultStatusBar = useMemo(() => {
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
        userStatus={readOnly ? 'Read-only' : 'Editing'}
      />
    );
  }, [content, readOnly]);

  // --- Type label ---
  const typeLabel = PROPOSAL_TYPE_LABELS[proposalType as ProposalType] ?? proposalType;

  // --- Render editor ---
  const renderEditor = () => (
    <div>
      <ProposalEditor
        content={{
          title: content.title,
          abstract: content.abstract,
          motivation: content.motivation,
          rationale: content.rationale,
        }}
        mode={mode}
        onContentChange={readOnly ? undefined : handleContentChange}
        readOnly={readOnly || mode === 'review'}
        onSlashCommand={handleSlashCommand}
        onCommand={handleCommand}
        onDiffAccept={(editId) => {
          posthog.capture('workspace_inline_edit_accepted', {
            proposal_id: proposalId,
            edit_id: editId,
          });
        }}
        onDiffReject={(editId) => {
          posthog.capture('workspace_inline_edit_rejected', {
            proposal_id: proposalId,
            edit_id: editId,
          });
        }}
        currentUserId={stakeAddress ?? 'anonymous'}
        onEditorReady={handleEditorReady}
      />
      {belowEditor}
    </div>
  );

  // --- Render chat panel ---
  const renderChatPanel = () => {
    if (chatTabs) {
      return chatTabs;
    }

    return (
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
  };

  return (
    <WorkspaceLayout
      className={layoutClassName}
      toolbar={
        <div className="flex items-center">
          <WorkspaceToolbar
            title={content.title}
            proposalType={typeLabel}
            mode={mode}
            onModeChange={showModeSwitch ? setMode : () => {}}
          />
          {toolbarActions}
        </div>
      }
      editor={renderEditor()}
      chat={renderChatPanel()}
      statusBar={statusBarOverride ?? defaultStatusBar}
    />
  );
}
