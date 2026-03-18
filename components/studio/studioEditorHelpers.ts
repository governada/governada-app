/**
 * Shared helpers for Studio editor integration (author + review flows).
 *
 * Centralises slash-command prompts, editor-context building, and inline
 * comment injection so both the author editor page and ReviewWorkspace can
 * import from a single location.
 */

import type { Editor } from '@tiptap/core';
import type {
  EditorMode,
  AmendmentEditorMode,
  EditorContext,
  ProposalField,
  ProposedComment,
  SlashCommandType,
} from '@/lib/workspace/editor/types';
import type { ConstitutionSlashCommandType } from '@/components/workspace/editor/ConstitutionSlashCommands';

// ---------------------------------------------------------------------------
// Slash command -> agent prompt mapping
// ---------------------------------------------------------------------------

export const SLASH_COMMAND_PROMPTS: Record<SlashCommandType, (section: string) => string> = {
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

export function buildEditorContext(
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

export function injectInlineComment(editor: Editor, comment: ProposedComment): void {
  const { doc } = editor.state;
  let sectionStart = 0;
  let found = false;

  doc.descendants((node, pos) => {
    if (found) return false;
    if (
      (node.type.name === 'sectionBlock' || node.type.name === 'constitutionSection') &&
      node.attrs.field === comment.field
    ) {
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
// Constitution editor context
// ---------------------------------------------------------------------------

export interface ConstitutionEditorContext {
  /** Currently selected text (if any) */
  selectedText?: string;
  /** Which constitution section the cursor is in */
  cursorSection?: string;
  /** Current content of all constitution sections */
  currentContent: Record<string, string>;
  /** Current editor mode */
  mode: AmendmentEditorMode;
}

/**
 * Build editor context for the constitution editor.
 * Like buildEditorContext but handles constitutionSection nodes and
 * accepts a Record<string, string> for section content.
 */
export function buildConstitutionEditorContext(
  editor: Editor | null,
  constitutionContent: Record<string, string>,
  mode: AmendmentEditorMode,
): ConstitutionEditorContext {
  let selectedText: string | undefined;
  let cursorSection: string | undefined;

  if (editor) {
    const { from, to, empty } = editor.state.selection;
    if (!empty) {
      selectedText = editor.state.doc.textBetween(from, to, '\n');
    }

    const resolvedPos = editor.state.doc.resolve(from);
    for (let depth = resolvedPos.depth; depth >= 0; depth--) {
      const node = resolvedPos.node(depth);
      if (node.type.name === 'constitutionSection' && node.attrs.field) {
        cursorSection = node.attrs.field as string;
        break;
      }
    }
  }

  return {
    selectedText,
    cursorSection,
    currentContent: constitutionContent,
    mode,
  };
}

// ---------------------------------------------------------------------------
// Constitution slash command -> agent prompt mapping
// ---------------------------------------------------------------------------

export const CONSTITUTION_SLASH_PROMPTS: Record<
  ConstitutionSlashCommandType,
  (section: string) => string
> = {
  amend: (section) =>
    `Propose specific amendments to the ${section} section of the Cardano Constitution. Show the exact text to change and what to replace it with, along with justification.`,
  'check-conflicts': (section) =>
    `Check if the proposed changes to the ${section} section conflict with any other articles in the Cardano Constitution. Flag cross-references that would need updating.`,
  'explain-impact': (section) =>
    `Explain the governance impact of changes to the ${section} section. How would this affect DReps, SPOs, the Constitutional Committee, and everyday ada holders?`,
  'compare-original': (section) =>
    `Show the original text of the ${section} section alongside the current proposed changes. Highlight what has been added, removed, and modified.`,
};
