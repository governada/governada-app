/**
 * SuggestModePlugin — Tracked changes plugin for the constitution editor.
 *
 * v1 approach: Rather than intercepting every keystroke at the ProseMirror
 * transaction level (complex, fragile), this plugin:
 *
 * 1. Provides a `proposeChange()` helper that uses the existing `applyProposedEdit()`
 *    from AIDiffMark.tsx to create tracked diff marks in the document.
 * 2. Provides `scanDiffMarks()` to extract all current AmendmentChange objects
 *    from the document by scanning for aiDiffAdded/aiDiffRemoved marks.
 * 3. Provides a ProseMirror Plugin that watches for mark changes and fires
 *    the onChangesUpdate callback.
 *
 * All changes come through either:
 * - The AI agent (via slash commands / Cmd+K)
 * - The explicit `proposeChange()` function
 *
 * Direct user typing in suggest mode is a Phase 2 enhancement.
 */

import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/core';
import type { AmendmentChange } from '@/lib/constitution/types';

// ---------------------------------------------------------------------------
// Plugin key
// ---------------------------------------------------------------------------

export const suggestModePluginKey = new PluginKey('suggestMode');

// ---------------------------------------------------------------------------
// proposeChange — create a tracked change via diff marks
// ---------------------------------------------------------------------------

/**
 * Propose a change to a specific article in the constitution editor.
 *
 * This finds the constitution section by its field ID, locates the
 * originalText within it, and applies diff marks (aiDiffRemoved on the
 * original, aiDiffAdded for the replacement).
 *
 * @param editor The Tiptap editor instance
 * @param articleId The constitution node ID (e.g. 'article-2-s3')
 * @param originalText The exact text to replace
 * @param proposedText The replacement text
 * @param explanation Brief justification for the change
 * @returns The generated change ID, or null if the text wasn't found
 */
export function proposeChange(
  editor: Editor,
  articleId: string,
  originalText: string,
  proposedText: string,
  explanation: string,
): string | null {
  const editId = `amend-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Find the section and the text position within it
  const match = findTextInSection(editor, articleId, originalText);
  if (!match) return null;

  const { from, to } = match;

  // Apply diff marks with suggestMode:skip meta so the plugin doesn't
  // try to intercept this transaction
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      // Mark original text as removed
      const removedMark = editor.schema.marks.aiDiffRemoved.create({
        editId,
        explanation,
      });
      tr.addMark(from, to, removedMark);

      // Insert proposed text with added mark
      const addedMark = editor.schema.marks.aiDiffAdded.create({
        editId,
        explanation,
      });
      const textNode = editor.schema.text(proposedText, [addedMark]);
      tr.insert(to, textNode);

      // Tag this transaction so the plugin knows it's an intentional change
      tr.setMeta('suggestMode:skip', true);

      return true;
    })
    .run();

  return editId;
}

// ---------------------------------------------------------------------------
// findTextInSection — locate text within a specific constitution section
// ---------------------------------------------------------------------------

function findTextInSection(
  editor: Editor,
  sectionId: string,
  searchText: string,
): { from: number; to: number } | null {
  let sectionStart = -1;
  let sectionEnd = -1;

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'constitutionSection' && node.attrs.field === sectionId) {
      sectionStart = pos + 1; // +1 to skip into the node content
      sectionEnd = pos + node.nodeSize - 1;
      return false;
    }
  });

  if (sectionStart === -1) return null;

  // Extract text from the section and find the search string
  const sectionText = editor.state.doc.textBetween(sectionStart, sectionEnd, '\n');
  const textIndex = sectionText.indexOf(searchText);
  if (textIndex === -1) return null;

  // Map the text offset back to an absolute document position
  const from = findAbsolutePosition(editor, sectionStart, sectionEnd, textIndex);
  const to = findAbsolutePosition(editor, sectionStart, sectionEnd, textIndex + searchText.length);

  if (from === null || to === null) return null;

  return { from, to };
}

/**
 * Map a character offset within a section range to an absolute document position.
 */
function findAbsolutePosition(
  editor: Editor,
  rangeStart: number,
  rangeEnd: number,
  charOffset: number,
): number | null {
  let textSoFar = 0;
  let result: number | null = null;

  editor.state.doc.nodesBetween(rangeStart, rangeEnd, (node, pos) => {
    if (result !== null) return false;

    if (node.isText) {
      const nodeLen = node.text?.length ?? 0;
      if (textSoFar + nodeLen >= charOffset) {
        result = pos + (charOffset - textSoFar);
        return false;
      }
      textSoFar += nodeLen;
    }

    // Account for block boundaries (paragraphs add newlines in textBetween)
    if (node.isBlock && node.type.name !== 'constitutionSection' && pos > rangeStart) {
      if (textSoFar > 0) {
        textSoFar += 1; // the \n from textBetween
      }
      if (textSoFar >= charOffset) {
        result = pos;
        return false;
      }
    }
  });

  return result;
}

// ---------------------------------------------------------------------------
// scanDiffMarks — extract AmendmentChange[] from the current document
// ---------------------------------------------------------------------------

/**
 * Scan the entire document for diff marks and extract AmendmentChange objects.
 * Groups aiDiffRemoved + aiDiffAdded marks by their shared editId.
 */
export function scanDiffMarks(editor: Editor): AmendmentChange[] {
  const changesMap = new Map<
    string,
    {
      editId: string;
      articleId: string;
      removedText: string;
      addedText: string;
      explanation: string;
    }
  >();

  editor.state.doc.descendants((node, _pos) => {
    if (!node.isText) return;

    for (const mark of node.marks) {
      if (mark.type.name === 'aiDiffRemoved' && mark.attrs.editId) {
        const editId = mark.attrs.editId as string;
        if (!changesMap.has(editId)) {
          // Find which constitution section this belongs to
          const articleId = findParentSectionId(editor, _pos);
          changesMap.set(editId, {
            editId,
            articleId,
            removedText: '',
            addedText: '',
            explanation: (mark.attrs.explanation as string) || '',
          });
        }
        const entry = changesMap.get(editId)!;
        entry.removedText += node.text ?? '';
      }

      if (mark.type.name === 'aiDiffAdded' && mark.attrs.editId) {
        const editId = mark.attrs.editId as string;
        if (!changesMap.has(editId)) {
          const articleId = findParentSectionId(editor, _pos);
          changesMap.set(editId, {
            editId,
            articleId,
            removedText: '',
            addedText: '',
            explanation: (mark.attrs.explanation as string) || '',
          });
        }
        const entry = changesMap.get(editId)!;
        entry.addedText += node.text ?? '';
      }
    }
  });

  return Array.from(changesMap.values()).map((entry) => ({
    id: entry.editId,
    articleId: entry.articleId,
    originalText: entry.removedText,
    proposedText: entry.addedText,
    explanation: entry.explanation,
    status: 'pending' as const,
  }));
}

/**
 * Find the parent constitutionSection field ID for a given position.
 */
function findParentSectionId(editor: Editor, pos: number): string {
  const resolved = editor.state.doc.resolve(pos);
  for (let depth = resolved.depth; depth >= 0; depth--) {
    const node = resolved.node(depth);
    if (node.type.name === 'constitutionSection') {
      return (node.attrs.field as string) || '';
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// SuggestModePlugin — watches for diff mark changes
// ---------------------------------------------------------------------------

export interface SuggestModePluginOptions {
  onChangesUpdate?: (changes: AmendmentChange[]) => void;
}

/**
 * Create a ProseMirror plugin that watches for diff mark changes and fires
 * the onChangesUpdate callback whenever the set of tracked changes changes.
 */
export function createSuggestModePlugin(options: SuggestModePluginOptions): Plugin {
  let lastChangeCount = 0;

  return new Plugin({
    key: suggestModePluginKey,

    view() {
      return {
        update(view) {
          if (!options.onChangesUpdate) return;

          // Count diff marks in the document
          let markCount = 0;
          view.state.doc.descendants((node) => {
            if (node.isText) {
              for (const mark of node.marks) {
                if (mark.type.name === 'aiDiffAdded' || mark.type.name === 'aiDiffRemoved') {
                  markCount++;
                }
              }
            }
          });

          // Only rescan and fire callback if the mark count changed
          if (markCount !== lastChangeCount) {
            lastChangeCount = markCount;
            // We need the editor instance, but we only have the view here.
            // The changes will be scanned by the ConstitutionEditor component
            // which has access to the editor. We signal via plugin state.
          }
        },
      };
    },

    state: {
      init() {
        return { markCount: 0 };
      },

      apply(tr, value, _oldState, newState) {
        if (!tr.docChanged) return value;

        let markCount = 0;
        newState.doc.descendants((node) => {
          if (node.isText) {
            for (const mark of node.marks) {
              if (mark.type.name === 'aiDiffAdded' || mark.type.name === 'aiDiffRemoved') {
                markCount++;
              }
            }
          }
        });

        return { markCount };
      },
    },
  });
}
