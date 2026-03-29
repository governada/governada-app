'use client';

/**
 * AIDiffMark — Custom Tiptap mark extension for inline diffs.
 *
 * Renders green highlight for added text and red strikethrough for removed text.
 * Supports accept (Tab) and reject (Escape) keybindings.
 *
 * When a ProposedEdit is injected into the editor:
 * 1. The original text at the specified range gets wrapped in `aiDiffRemoved` marks
 * 2. The proposed replacement text is inserted after with `aiDiffAdded` marks
 * 3. Tab accepts the edit (removes the `removed` marks and their text, keeps `added` text as plain)
 * 4. Escape rejects the edit (removes the `added` marks and their text, keeps `removed` text as plain)
 */

import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/core';
import type { ProposedEdit, ProposalField } from '@/lib/workspace/editor/types';

// ---------------------------------------------------------------------------
// Mark: AIDiffAdded — green highlight for proposed new text
// ---------------------------------------------------------------------------

export const AIDiffAdded = Mark.create({
  name: 'aiDiffAdded',
  excludes: '_',
  inclusive: false,

  addAttributes() {
    return {
      editId: { default: null },
      explanation: { default: null, rendered: false },
      authorName: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-ai-diff-added]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const isReviewer =
      typeof HTMLAttributes.editId === 'string' && HTMLAttributes.editId.startsWith('review-');
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-ai-diff-added': '',
        class: isReviewer
          ? 'ai-diff-added bg-blue-200/60 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 rounded-sm px-0.5'
          : 'ai-diff-added bg-emerald-200/60 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100 rounded-sm px-0.5',
        title: HTMLAttributes.explanation
          ? `${isReviewer ? 'Reviewer' : 'AI'} suggestion: ${HTMLAttributes.explanation}`
          : `${isReviewer ? 'Reviewer' : 'AI'}-proposed addition (Tab to accept, Escape to reject)`,
      }),
      0,
    ];
  },
});

// ---------------------------------------------------------------------------
// Mark: AIDiffRemoved — red strikethrough for text to be replaced
// ---------------------------------------------------------------------------

export const AIDiffRemoved = Mark.create({
  name: 'aiDiffRemoved',
  excludes: '_',
  inclusive: false,

  addAttributes() {
    return {
      editId: { default: null },
      explanation: { default: null, rendered: false },
      authorName: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-ai-diff-removed]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-ai-diff-removed': '',
        class:
          'ai-diff-removed bg-red-200/60 dark:bg-red-900/40 text-red-900 dark:text-red-100 line-through rounded-sm px-0.5 opacity-70',
        title: HTMLAttributes.explanation
          ? `Suggested removal: ${HTMLAttributes.explanation}`
          : 'Will be removed (Tab to accept, Escape to reject)',
      }),
      0,
    ];
  },
});

// ---------------------------------------------------------------------------
// Plugin key for the diff management plugin
// ---------------------------------------------------------------------------

const aiDiffPluginKey = new PluginKey('aiDiff');

// ---------------------------------------------------------------------------
// Helper: find mark ranges in the document
// ---------------------------------------------------------------------------

function findMarkRanges(editor: Editor, markName: string, editId: string) {
  const ranges: Array<{ from: number; to: number }> = [];
  const { doc } = editor.state;

  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => m.type.name === markName && m.attrs.editId === editId);
    if (mark) {
      ranges.push({ from: pos, to: pos + node.nodeSize });
    }
  });

  // Merge adjacent ranges
  const merged: Array<{ from: number; to: number }> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && last.to === range.from) {
      last.to = range.to;
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Accept/Reject logic
// ---------------------------------------------------------------------------

/**
 * Accept the current AI diff: remove the `aiDiffRemoved` text and unmark the `aiDiffAdded` text.
 */
export function acceptDiff(editor: Editor, editId: string): boolean {
  const removedRanges = findMarkRanges(editor, 'aiDiffRemoved', editId);
  const addedRanges = findMarkRanges(editor, 'aiDiffAdded', editId);

  if (removedRanges.length === 0 && addedRanges.length === 0) return false;

  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      // First, unmark the added text (keep the text, remove the mark)
      for (const range of addedRanges) {
        const markType = editor.schema.marks.aiDiffAdded;
        tr.removeMark(range.from, range.to, markType);
      }

      // Then delete the removed text (in reverse order to preserve positions)
      const sortedRemoved = [...removedRanges].sort((a, b) => b.from - a.from);
      for (const range of sortedRemoved) {
        tr.delete(range.from, range.to);
      }

      return true;
    })
    .run();

  return true;
}

/**
 * Reject the current AI diff: remove the `aiDiffAdded` text and unmark the `aiDiffRemoved` text.
 */
export function rejectDiff(editor: Editor, editId: string): boolean {
  const removedRanges = findMarkRanges(editor, 'aiDiffRemoved', editId);
  const addedRanges = findMarkRanges(editor, 'aiDiffAdded', editId);

  if (removedRanges.length === 0 && addedRanges.length === 0) return false;

  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      // First, unmark the removed text (keep the text, remove the mark)
      for (const range of removedRanges) {
        const markType = editor.schema.marks.aiDiffRemoved;
        tr.removeMark(range.from, range.to, markType);
      }

      // Then delete the added text (in reverse order to preserve positions)
      const sortedAdded = [...addedRanges].sort((a, b) => b.from - a.from);
      for (const range of sortedAdded) {
        tr.delete(range.from, range.to);
      }

      return true;
    })
    .run();

  return true;
}

// ---------------------------------------------------------------------------
// Find the active edit ID (the first diff mark near the cursor)
// ---------------------------------------------------------------------------

function findActiveEditId(editor: Editor): string | null {
  const { doc } = editor.state;
  // Find the first editId in the document (there should only be one active at a time)
  let editId: string | null = null;

  doc.descendants((node) => {
    if (editId) return false; // stop once found
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type.name === 'aiDiffAdded' || mark.type.name === 'aiDiffRemoved') {
        editId = mark.attrs.editId as string;
        return false;
      }
    }
  });

  return editId;
}

// ---------------------------------------------------------------------------
// AIDiff extension — registers marks + keyboard shortcuts
// ---------------------------------------------------------------------------

export interface AIDiffOptions {
  /** Called after an edit is accepted */
  onAccept?: (editId: string) => void;
  /** Called after an edit is rejected */
  onReject?: (editId: string) => void;
}

export const AIDiff = Mark.create<AIDiffOptions>({
  name: 'aiDiff',
  // This is a "virtual" mark that just registers the keyboard shortcuts
  // The actual marks are AIDiffAdded and AIDiffRemoved above

  addOptions() {
    return {
      onAccept: undefined,
      onReject: undefined,
    };
  },

  // We don't actually render this mark — it's just a container for the keyboard shortcuts
  parseHTML() {
    return [];
  },

  renderHTML() {
    return ['span', {}, 0];
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const editId = findActiveEditId(this.editor);
        if (!editId) return false;
        const result = acceptDiff(this.editor, editId);
        if (result) this.options.onAccept?.(editId);
        return result;
      },
      Escape: () => {
        const editId = findActiveEditId(this.editor);
        if (!editId) return false;
        const result = rejectDiff(this.editor, editId);
        if (result) this.options.onReject?.(editId);
        return result;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: aiDiffPluginKey,
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// Public API: apply a proposed edit to the editor
// ---------------------------------------------------------------------------

/**
 * Apply a ProposedEdit to a specific section editor.
 *
 * This finds the section by field name, then:
 * 1. Wraps the original text range in `aiDiffRemoved` marks
 * 2. Inserts the proposed text with `aiDiffAdded` marks after the original
 *
 * @param editor The Tiptap editor instance for the section
 * @param edit The proposed edit from the agent
 * @param editId Unique identifier for this edit (for accept/reject tracking)
 */
export function applyProposedEdit(editor: Editor, edit: ProposedEdit, editId: string): void {
  const { anchorStart, anchorEnd, proposedText } = edit;

  // Calculate absolute positions
  // anchorStart/anchorEnd are character offsets within the section's text content
  // We need to map these to absolute document positions
  const from = findTextPosition(editor, edit.field, anchorStart);
  const to = findTextPosition(editor, edit.field, anchorEnd);

  if (from === null || to === null) return;

  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      // 1. Mark the original text as removed
      const removedMark = editor.schema.marks.aiDiffRemoved.create({ editId });
      tr.addMark(from, to, removedMark);

      // 2. Insert the proposed text after the removed text, with added mark
      const addedMark = editor.schema.marks.aiDiffAdded.create({ editId });
      const textNode = editor.schema.text(proposedText, [addedMark]);
      tr.insert(to, textNode);

      return true;
    })
    .run();
}

/**
 * Find the absolute document position for a character offset within a section.
 */
function findTextPosition(editor: Editor, field: ProposalField, charOffset: number): number | null {
  let textSoFar = 0;
  let result: number | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (result !== null) return false;

    if (node.type.name === 'sectionBlock') {
      // Only process the target section
      if (node.attrs.field !== field) return false;
      return; // continue into children
    }

    if (node.isText) {
      const nodeLen = node.text?.length ?? 0;
      if (textSoFar + nodeLen >= charOffset) {
        result = pos + (charOffset - textSoFar);
        return false;
      }
      textSoFar += nodeLen;
    }
  });

  return result;
}

/**
 * Accept all pending diffs in the editor.
 */
export function acceptAllDiffs(editor: Editor): void {
  const editId = findActiveEditId(editor);
  if (editId) acceptDiff(editor, editId);
}

/**
 * Reject all pending diffs in the editor.
 */
export function rejectAllDiffs(editor: Editor): void {
  const editId = findActiveEditId(editor);
  if (editId) rejectDiff(editor, editId);
}

// ---------------------------------------------------------------------------
// Reviewer tracked change: apply at current selection range
// ---------------------------------------------------------------------------

/**
 * Apply a reviewer's tracked change at the current editor selection.
 *
 * Unlike `applyProposedEdit()` which uses field-relative character offsets,
 * this operates on the current selection range directly — ideal for the
 * "Suggest Edit" toolbar action where the reviewer has selected text.
 */
export function applyReviewerEdit(
  editor: Editor,
  proposedText: string,
  explanation: string,
  authorName: string,
): string | null {
  const { from, to } = editor.state.selection;
  if (from === to) return null;

  const editId = `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Temporarily enable editing if in review mode
  const wasEditable = editor.isEditable;
  if (!wasEditable) editor.setEditable(true);

  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      // Mark the selected text as removed
      const removedMark = editor.schema.marks.aiDiffRemoved.create({
        editId,
        explanation,
        authorName,
      });
      tr.addMark(from, to, removedMark);

      // Insert proposed text after with added mark
      const addedMark = editor.schema.marks.aiDiffAdded.create({
        editId,
        explanation,
        authorName,
      });
      const textNode = editor.schema.text(proposedText, [addedMark]);
      tr.insert(to, textNode);

      return true;
    })
    .run();

  if (!wasEditable) editor.setEditable(false);

  return editId;
}

/**
 * Scan the document for all tracked changes (both AI and reviewer).
 * Returns metadata for each editId found.
 */
export function scanAllTrackedChanges(editor: Editor): Array<{
  editId: string;
  originalText: string;
  proposedText: string;
  explanation: string | null;
  authorName: string | null;
  isReviewer: boolean;
}> {
  const changesMap = new Map<
    string,
    {
      editId: string;
      removedText: string;
      addedText: string;
      explanation: string | null;
      authorName: string | null;
    }
  >();

  editor.state.doc.descendants((node) => {
    if (!node.isText) return;

    for (const mark of node.marks) {
      if (mark.type.name === 'aiDiffRemoved' && mark.attrs.editId) {
        const editId = mark.attrs.editId as string;
        if (!changesMap.has(editId)) {
          changesMap.set(editId, {
            editId,
            removedText: '',
            addedText: '',
            explanation: (mark.attrs.explanation as string) || null,
            authorName: (mark.attrs.authorName as string) || null,
          });
        }
        changesMap.get(editId)!.removedText += node.text ?? '';
      }

      if (mark.type.name === 'aiDiffAdded' && mark.attrs.editId) {
        const editId = mark.attrs.editId as string;
        if (!changesMap.has(editId)) {
          changesMap.set(editId, {
            editId,
            removedText: '',
            addedText: '',
            explanation: (mark.attrs.explanation as string) || null,
            authorName: (mark.attrs.authorName as string) || null,
          });
        }
        changesMap.get(editId)!.addedText += node.text ?? '';
      }
    }
  });

  return Array.from(changesMap.values()).map((entry) => ({
    editId: entry.editId,
    originalText: entry.removedText,
    proposedText: entry.addedText,
    explanation: entry.explanation,
    authorName: entry.authorName,
    isReviewer: entry.editId.startsWith('review-'),
  }));
}
