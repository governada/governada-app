'use client';

/**
 * ProposalEditor — Tiptap-based governance proposal editor.
 *
 * Central orchestrator that registers all custom extensions:
 * - SectionBlock: labeled proposal sections with metadata headers
 * - AIDiffMark: inline diffs with accept/reject
 * - InlineComment: text-anchored comments with popovers
 * - SlashCommandMenu: slash command dropdown
 * - CommandBar: Cmd+K overlay for free-form AI instructions
 * - AICompletion: ghost text completion suggestions
 * - MarginDecorations: gutter indicators for constitutional risk + annotations
 *
 * Accepts callbacks for slash commands, Cmd+K instructions, comment creation,
 * and diff accept/reject — the integration phase will connect these to the agent.
 */

import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import Document from '@tiptap/extension-document';

import { SectionBlock, buildSectionDocument, extractSectionContent } from './SectionBlock';
import { AIDiff, AIDiffAdded, AIDiffRemoved, applyProposedEdit } from './AIDiffMark';
import { AICompletion, setCompletion, clearCompletion } from './AICompletionDecoration';
import { SlashCommandMenu } from './SlashCommandMenu';
import { CommandBarExtension, CommandBarUI } from './CommandBar';
import { InlineComment, CommentPopover } from './InlineComment';
import { MarginDecorations, setMarginIndicators } from './MarginDecorations';
import { SelectionToolbar } from './SelectionToolbar';
import { FormattingToolbar } from './FormattingToolbar';
import { VersionDiffView } from './VersionDiffView';

import type {
  EditorMode,
  ProposalField,
  ProposedEdit,
  InlineCommentData,
  SlashCommandType,
  MarginIndicator,
} from '@/lib/workspace/editor/types';
import type { DraftContent } from '@/lib/workspace/types';
import type { Editor } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Custom Document that allows sectionBlock at top level
// ---------------------------------------------------------------------------

const ProposalDocument = Document.extend({
  content: 'sectionBlock+',
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProposalEditorProps {
  /** Initial content per section */
  content: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
  /** Editor mode */
  mode: EditorMode;
  /** Called when content changes (debounced save) */
  onContentChange?: (field: ProposalField, content: string) => void;
  /** Whether the editor is read-only (review mode) */
  readOnly?: boolean;

  // --- AI integration callbacks ---

  /** Called when a slash command is invoked */
  onSlashCommand?: (command: SlashCommandType, sectionContext: string) => void;
  /** Called when Cmd+K instruction is submitted */
  onCommand?: (instruction: string, selectedText: string, section: string) => void;
  /** Called when user creates an inline comment */
  onCommentCreate?: (
    comment: Omit<InlineCommentData, 'id' | 'timestamp'>,
    from: number,
    to: number,
  ) => void;
  /** Called when a comment is deleted */
  onCommentDelete?: (commentId: string) => void;
  /** Called when an AI diff is accepted */
  onDiffAccept?: (editId: string) => void;
  /** Called when an AI diff is rejected */
  onDiffReject?: (editId: string) => void;
  /** Called when a completion is accepted */
  onCompletionAccept?: (text: string) => void;

  // --- Diff mode props ---

  /** Previous version content (for diff mode) */
  diffOldContent?: DraftContent;
  /** Old version label */
  diffOldLabel?: string;
  /** New version label */
  diffNewLabel?: string;
  /** Whether to collapse unchanged sections in diff view */
  diffCollapseUnchanged?: boolean;
  /** Change justifications for diff view */
  diffJustifications?: Array<{
    field: string;
    justification: string;
    linkedThemeId?: string;
  }>;

  // --- External data ---

  /** Current user's ID (for comment ownership styling) */
  currentUserId?: string;
  /** Margin indicators (constitutional risk, annotation counts) */
  marginIndicators?: MarginIndicator[];

  // --- Integration callback ---

  /** Called once the editor instance is ready (for parent-level integration) */
  onEditorReady?: (editor: Editor) => void;

  /** Fields to exclude from the editor document */
  excludeFields?: ProposalField[];
}

// ---------------------------------------------------------------------------
// Editor storage type helper
// ---------------------------------------------------------------------------

interface CommandBarStorage {
  isOpen: boolean;
  selectedText: string;
  section: string;
}

function getCommandBarStorage(editor: Editor): CommandBarStorage | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storage = (editor.storage as any).commandBar as CommandBarStorage | undefined;
  return storage ?? null;
}

function setCommandBarStorageClosed(editor: Editor): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storage = (editor.storage as any).commandBar as CommandBarStorage | undefined;
  if (storage) storage.isOpen = false;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProposalEditor({
  content,
  mode,
  onContentChange,
  readOnly = false,
  onSlashCommand,
  onCommand,
  onCommentDelete,
  onDiffAccept,
  onDiffReject,
  onCompletionAccept,
  diffOldContent,
  diffOldLabel,
  diffNewLabel,
  diffCollapseUnchanged,
  diffJustifications,
  currentUserId,
  marginIndicators,
  onEditorReady,
  excludeFields,
}: ProposalEditorProps) {
  const isReadOnly = readOnly || mode === 'review';

  // Command bar state (read from editor storage)
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [commandBarSelectedText, setCommandBarSelectedText] = useState('');
  const [commandBarSection, setCommandBarSection] = useState('');

  // Comment popover state
  const [activeComment, setActiveComment] = useState<{
    comment: InlineCommentData;
    coords: { top: number; left: number };
  } | null>(null);

  // Track previous margin indicators to avoid unnecessary updates
  const prevIndicatorsRef = useRef<MarginIndicator[] | undefined>(undefined);

  // Stable refs for callbacks (avoid re-creating extensions on every render)
  const callbacksRef = useRef({
    onSlashCommand,
    onCommand,
    onDiffAccept,
    onDiffReject,
    onCompletionAccept,
    onCommentDelete,
    currentUserId,
  });
  callbacksRef.current = {
    onSlashCommand,
    onCommand,
    onDiffAccept,
    onDiffReject,
    onCompletionAccept,
    onCommentDelete,
    currentUserId,
  };

  // -------------------------------------------------------------------------
  // Build extensions once (stable reference)
  // -------------------------------------------------------------------------

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        document: false,
      }),
      ProposalDocument,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'paragraph') {
            return 'Start writing...';
          }
          return '';
        },
      }),
      CharacterCount.configure({}),
      SectionBlock,
      AIDiffAdded,
      AIDiffRemoved,
      AIDiff.configure({
        onAccept: (editId: string) => callbacksRef.current.onDiffAccept?.(editId),
        onReject: (editId: string) => callbacksRef.current.onDiffReject?.(editId),
      }),
      AICompletion.configure({
        onAccept: (text: string) => callbacksRef.current.onCompletionAccept?.(text),
      }),
      SlashCommandMenu.configure({
        onSlashCommand: (command: SlashCommandType, section: string) =>
          callbacksRef.current.onSlashCommand?.(command, section),
      }),
      CommandBarExtension.configure({
        onCommand: (instruction: string, selectedText: string, section: string) => {
          callbacksRef.current.onCommand?.(instruction, selectedText, section);
        },
      }),
      InlineComment.configure({
        currentUserId,
        onCommentClick: (comment: InlineCommentData, coords: { top: number; left: number }) => {
          setActiveComment({ comment, coords });
        },
      }),
      MarginDecorations.configure({
        indicators: marginIndicators,
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'text-primary underline hover:opacity-80',
        },
      }),
      Table.configure({
        resizable: false,
        HTMLAttributes: {
          class: 'border-collapse w-full text-sm my-3',
        },
      }),
      TableRow,
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-border px-3 py-2',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-border px-3 py-2 font-semibold bg-muted/50 text-left',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: 'rounded-lg max-w-full my-3',
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'not-prose space-y-1 my-3',
        },
      }),
      TaskItem.configure({
        nested: false,
        HTMLAttributes: {
          class: 'flex items-start gap-2',
        },
      }),
    ],
    // Only re-create extensions when currentUserId changes (rare)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId],
  );

  // -------------------------------------------------------------------------
  // Editor instance
  // -------------------------------------------------------------------------

  const initialContent = useMemo(
    () =>
      buildSectionDocument(content, {
        excludeFields: excludeFields || undefined,
        parseMarkdown: isReadOnly,
      }),
    [content, excludeFields, isReadOnly],
  );

  const editor = useEditor({
    extensions,
    content: initialContent,
    editable: !isReadOnly,
    editorProps: {
      attributes: {
        class: 'proposal-editor focus:outline-none relative',
      },
    },
    onUpdate: ({ editor: e }) => {
      if (isReadOnly || !onContentChange) return;
      const json = e.getJSON();
      const sections = extractSectionContent(json as Parameters<typeof extractSectionContent>[0]);
      for (const field of ['title', 'abstract', 'motivation', 'rationale'] as ProposalField[]) {
        onContentChange(field, sections[field]);
      }
    },
  });

  // -------------------------------------------------------------------------
  // Sync readOnly state
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (editor) editor.setEditable(!isReadOnly);
  }, [editor, isReadOnly]);

  // -------------------------------------------------------------------------
  // Notify parent when editor is ready
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  // -------------------------------------------------------------------------
  // Poll command bar state from editor storage
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!editor) return;

    const interval = setInterval(() => {
      const storage = getCommandBarStorage(editor);
      if (storage?.isOpen && !commandBarOpen) {
        setCommandBarOpen(true);
        setCommandBarSelectedText(storage.selectedText || '');
        setCommandBarSection(storage.section || '');
      }
    }, 100);

    return () => clearInterval(interval);
  }, [editor, commandBarOpen]);

  // -------------------------------------------------------------------------
  // Update margin indicators when they change
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!editor || !marginIndicators) return;
    if (prevIndicatorsRef.current === marginIndicators) return;
    prevIndicatorsRef.current = marginIndicators;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setMarginIndicators(editor as any, marginIndicators);
  }, [editor, marginIndicators]);

  // -------------------------------------------------------------------------
  // Command bar handlers
  // -------------------------------------------------------------------------

  const handleCommandBarSubmit = useCallback(
    (instruction: string, selectedText: string, section: string) => {
      onCommand?.(instruction, selectedText, section);
      setCommandBarOpen(false);
      if (editor) {
        setCommandBarStorageClosed(editor);
        editor.commands.focus();
      }
    },
    [editor, onCommand],
  );

  const handleCommandBarDismiss = useCallback(() => {
    setCommandBarOpen(false);
    if (editor) {
      setCommandBarStorageClosed(editor);
      editor.commands.focus();
    }
  }, [editor]);

  // -------------------------------------------------------------------------
  // Comment handlers
  // -------------------------------------------------------------------------

  const handleCommentClose = useCallback(() => {
    setActiveComment(null);
  }, []);

  const handleCommentDelete = useCallback(
    (commentId: string) => {
      if (editor) {
        // Find and remove comment marks with this ID
        const { doc } = editor.state;
        const ranges: Array<{ from: number; to: number }> = [];

        doc.descendants((node, pos) => {
          if (!node.isText) return;
          const mark = node.marks.find(
            (m) => m.type.name === 'inlineComment' && m.attrs.id === commentId,
          );
          if (mark) {
            ranges.push({ from: pos, to: pos + node.nodeSize });
          }
        });

        if (ranges.length > 0) {
          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              for (const range of ranges) {
                tr.removeMark(range.from, range.to, editor.schema.marks.inlineComment);
              }
              return true;
            })
            .run();
        }
      }
      onCommentDelete?.(commentId);
      setActiveComment(null);
    },
    [editor, onCommentDelete],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Diff mode renders a separate view
  if (mode === 'diff' && diffOldContent) {
    return (
      <VersionDiffView
        oldContent={diffOldContent}
        newContent={content as DraftContent}
        oldLabel={diffOldLabel}
        newLabel={diffNewLabel}
        collapseUnchanged={diffCollapseUnchanged}
        justifications={diffJustifications}
      />
    );
  }

  return (
    <div className="proposal-editor-wrapper relative">
      {/* Formatting toolbar — shown in edit mode only */}
      {editor && !isReadOnly && <FormattingToolbar editor={editor} />}

      {/* Tiptap editor */}
      <div className="p-6">
        <EditorContent editor={editor} />
      </div>

      {/* Selection toolbar — floating comment button on text selection */}
      {editor && <SelectionToolbar editor={editor} currentUserId={currentUserId ?? 'anonymous'} />}

      {/* Command Bar overlay (Cmd+K) */}
      <CommandBarUI
        isOpen={commandBarOpen}
        selectedText={commandBarSelectedText}
        section={commandBarSection}
        onSubmit={handleCommandBarSubmit}
        onDismiss={handleCommandBarDismiss}
      />

      {/* Comment popover */}
      {activeComment && (
        <CommentPopover
          comment={activeComment.comment}
          coords={activeComment.coords}
          isOwn={activeComment.comment.authorId === currentUserId}
          onClose={handleCommentClose}
          onDelete={handleCommentDelete}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public imperative API (for agent integration)
// ---------------------------------------------------------------------------

/**
 * Inject a proposed edit into the editor as inline diff marks.
 * The user can Tab to accept or Escape to reject.
 */
export function injectProposedEdit(editor: Editor, edit: ProposedEdit, editId?: string): void {
  const id = editId || `edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  applyProposedEdit(editor, edit, id);
}

/**
 * Inject a completion suggestion (ghost text) at the cursor.
 */
export function injectCompletion(editor: Editor, text: string, pos: number): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setCompletion(editor as any, text, pos);
}

/**
 * Clear any active completion suggestion.
 */
export function dismissCompletion(editor: Editor): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clearCompletion(editor as any);
}

// Re-export for convenience
export { extractSectionContent } from './SectionBlock';
