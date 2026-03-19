'use client';

/**
 * ConstitutionEditor — Tiptap-based constitution editor with suggest mode.
 *
 * Peer to ProposalEditor, adapted for editing the Cardano Constitution:
 * - ConstitutionSection nodes (one per article/section)
 * - Suggest mode via tracked changes (diff marks)
 * - Article navigation via ConstitutionTOC
 * - Constitution-specific slash commands
 *
 * Reuses AIDiffMark, MarginDecorations, InlineComment, CommandBar,
 * SelectionToolbar, and AICompletion from the shared editor extensions.
 */

import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Document from '@tiptap/extension-document';

import {
  ConstitutionSection,
  buildConstitutionDocument,
  extractConstitutionContent,
} from './ConstitutionSection';
import { AIDiff, AIDiffAdded, AIDiffRemoved } from './AIDiffMark';
import { AICompletion } from './AICompletionDecoration';
import { CommandBarExtension, CommandBarUI } from './CommandBar';
import { InlineComment, CommentPopover } from './InlineComment';
import { MarginDecorations, setMarginIndicators } from './MarginDecorations';
import { SelectionToolbar } from './SelectionToolbar';
import { FormattingToolbar } from './FormattingToolbar';
import { ConstitutionTOC } from './ConstitutionTOC';
import { scanDiffMarks } from './SuggestModePlugin';
import { createConstitutionSlashMenu } from './ConstitutionSlashMenuExtension';
import { BlockHandleExtension } from './BlockHandleExtension';

import type { ReactNode } from 'react';
import type { ConstitutionNode } from '@/lib/constitution/fullText';
import type { AmendmentChange } from '@/lib/constitution/types';
import type {
  AmendmentEditorMode,
  MarginIndicator,
  InlineCommentData,
} from '@/lib/workspace/editor/types';
import type { Editor } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Custom Document that allows constitutionSection at top level
// ---------------------------------------------------------------------------

const ConstitutionDocument = Document.extend({
  content: 'constitutionSection+',
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConstitutionEditorProps {
  /** Constitution nodes to render */
  constitutionNodes: ConstitutionNode[];
  /** Pre-existing amendment changes to apply on mount */
  existingChanges?: AmendmentChange[];
  /** Editor mode: suggest (author) or review (read-only reviewer) */
  mode: AmendmentEditorMode;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Called when tracked changes are created/modified/removed */
  onChangesUpdate?: (changes: AmendmentChange[]) => void;
  /** Called once the editor instance is ready */
  onEditorReady?: (editor: Editor) => void;
  /** Called when a slash command is invoked */
  onSlashCommand?: (command: string, sectionContext: string) => void;
  /** Called when Cmd+K instruction is submitted */
  onCommand?: (instruction: string, selectedText: string, section: string) => void;
  /** Called when an AI diff is accepted */
  onDiffAccept?: (editId: string) => void;
  /** Called when an AI diff is rejected */
  onDiffReject?: (editId: string) => void;
  /** Margin indicators (constitutional risk, annotation counts) */
  marginIndicators?: MarginIndicator[];
  /** Sentiment slot components per section */
  sentimentSlots?: Record<string, ReactNode>;
  /** Current user's ID (for comment ownership styling) */
  currentUserId?: string;
  /** Focus mode: dims non-active sections */
  focusMode?: boolean;
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

export function ConstitutionEditor({
  constitutionNodes,
  existingChanges,
  mode,
  readOnly = false,
  onChangesUpdate,
  onEditorReady,
  onSlashCommand,
  onCommand,
  onDiffAccept,
  onDiffReject,
  marginIndicators,
  currentUserId,
  focusMode = false,
}: ConstitutionEditorProps) {
  const isReadOnly = readOnly || mode === 'review';

  // Command bar state
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [commandBarSelectedText, setCommandBarSelectedText] = useState('');
  const [commandBarSection, setCommandBarSection] = useState('');

  // Comment popover state
  const [activeComment, setActiveComment] = useState<{
    comment: InlineCommentData;
    coords: { top: number; left: number };
  } | null>(null);

  // Active section tracking (for TOC)
  const [activeSection, setActiveSection] = useState<string | undefined>(undefined);

  // Amended section IDs (for TOC)
  const [amendedIds, setAmendedIds] = useState<Set<string>>(new Set());

  // Track previous margin indicators
  const prevIndicatorsRef = useRef<MarginIndicator[] | undefined>(undefined);

  // Stable refs for callbacks
  const callbacksRef = useRef({
    onSlashCommand,
    onCommand,
    onDiffAccept,
    onDiffReject,
    onChangesUpdate,
    currentUserId,
  });
  callbacksRef.current = {
    onSlashCommand,
    onCommand,
    onDiffAccept,
    onDiffReject,
    onChangesUpdate,
    currentUserId,
  };

  // -------------------------------------------------------------------------
  // Build extensions once (stable reference)
  // -------------------------------------------------------------------------

  const extensions = useMemo(
    () => {
      const baseExtensions = [
        StarterKit.configure({
          heading: { levels: [1, 2, 3, 4, 5, 6] },
          document: false,
        }),
        ConstitutionDocument,
        Placeholder.configure({
          placeholder: ({ node }) => {
            if (node.type.name === 'paragraph') {
              return 'Constitution text...';
            }
            return '';
          },
        }),
        CharacterCount.configure({}),
        ConstitutionSection,
        AIDiffAdded,
        AIDiffRemoved,
        AIDiff.configure({
          onAccept: (editId: string) => {
            callbacksRef.current.onDiffAccept?.(editId);
            // Rescan changes after accept
            setTimeout(() => rescanChanges(), 50);
          },
          onReject: (editId: string) => {
            callbacksRef.current.onDiffReject?.(editId);
            // Rescan changes after reject
            setTimeout(() => rescanChanges(), 50);
          },
        }),
        AICompletion.configure({}),
        createConstitutionSlashMenu({
          onSlashCommand: (command: string, section: string) =>
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
        Image.configure({
          inline: false,
          allowBase64: false,
        }),
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        TaskList,
        TaskItem.configure({ nested: true }),
        BlockHandleExtension.configure({}),
      ];

      return baseExtensions;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId],
  );

  // -------------------------------------------------------------------------
  // Editor instance
  // -------------------------------------------------------------------------

  const initialContent = useMemo(
    () => buildConstitutionDocument(constitutionNodes),
    [constitutionNodes],
  );

  const editor = useEditor({
    extensions,
    content: initialContent,
    editable: !isReadOnly,
    editorProps: {
      attributes: {
        class: 'constitution-editor focus:outline-none relative',
      },
    },
    onUpdate: ({ editor: e }) => {
      // Rescan diff marks on content change
      rescanChangesFromEditor(e);
    },
  });

  // -------------------------------------------------------------------------
  // Rescan changes helper
  // -------------------------------------------------------------------------

  const rescanChangesFromEditor = useCallback((e: Editor) => {
    const changes = scanDiffMarks(e);
    // Update amended IDs for TOC
    const newAmendedIds = new Set(changes.map((c) => c.articleId));
    setAmendedIds(newAmendedIds);
    // Fire callback
    callbacksRef.current.onChangesUpdate?.(changes);
  }, []);

  const rescanChanges = useCallback(() => {
    if (!editor) return;
    rescanChangesFromEditor(editor);
  }, [editor, rescanChangesFromEditor]);

  // -------------------------------------------------------------------------
  // Apply existing changes on mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!editor || !existingChanges || existingChanges.length === 0) return;

    // Import proposeChange dynamically to avoid circular deps
    // Apply each existing change
    for (const change of existingChanges) {
      if (change.status !== 'pending') continue;

      // Use the proposeChange function from SuggestModePlugin
      import('./SuggestModePlugin').then(({ proposeChange }) => {
        proposeChange(
          editor,
          change.articleId,
          change.originalText,
          change.proposedText,
          change.explanation,
        );
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]); // Only run once when editor is ready

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
  // Track active section via scroll position
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!editor) return;

    const handleScroll = () => {
      const editorEl = editor.view.dom;
      const sections = editorEl.querySelectorAll('[data-section-field]');
      let currentSection: string | undefined;

      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= 200) {
          currentSection = section.getAttribute('data-section-field') || undefined;
        }
      }

      setActiveSection(currentSection);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [editor]);

  // -------------------------------------------------------------------------
  // TOC navigation handler
  // -------------------------------------------------------------------------

  const handleNavigate = useCallback(
    (sectionId: string) => {
      if (!editor) return;
      const editorEl = editor.view.dom;
      const section = editorEl.querySelector(`[data-section-field="${sectionId}"]`);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveSection(sectionId);
      }
    },
    [editor],
  );

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
      setActiveComment(null);
    },
    [editor],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      className={cn('constitution-editor-wrapper relative', focusMode && 'constitution-focus-mode')}
    >
      {/* Table of contents sidebar */}
      <ConstitutionTOC
        nodes={constitutionNodes}
        amendedIds={amendedIds}
        activeSection={activeSection}
        onNavigate={handleNavigate}
      />

      {/* Main editor area — offset for desktop TOC */}
      <div className="lg:ml-56 p-6 max-w-3xl mx-auto">
        {/* Formatting toolbar (edit mode only) */}
        {!isReadOnly && editor && <FormattingToolbar editor={editor} />}

        {/* Tiptap editor */}
        <EditorContent editor={editor} />

        {/* Selection toolbar — floating comment button on text selection */}
        {editor && (
          <SelectionToolbar editor={editor} currentUserId={currentUserId ?? 'anonymous'} />
        )}

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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public imperative API
// ---------------------------------------------------------------------------

/**
 * Extract the current content of all constitution sections from the editor.
 */
export function getConstitutionContent(editor: Editor): Record<string, string> {
  const json = editor.getJSON();
  return extractConstitutionContent(json as Parameters<typeof extractConstitutionContent>[0]);
}

// Re-exports for convenience
export { proposeChange } from './SuggestModePlugin';
export { scanDiffMarks } from './SuggestModePlugin';
export { extractConstitutionContent } from './ConstitutionSection';
