/**
 * Contract A: Editor ↔ Agent Communication Types
 *
 * These types define the boundary between the Tiptap editor and the AI agent.
 * The editor sends EditorContext with every agent message. The agent responds
 * with ProposedEdit or ProposedComment that the editor renders inline.
 */

/** Fields of a governance proposal document */
export type ProposalField = 'title' | 'abstract' | 'motivation' | 'rationale';

/** Annotation-capable fields (title excluded — too short for annotations) */
export type AnnotatableField = 'abstract' | 'motivation' | 'rationale';

/** Editor mode */
export type EditorMode = 'edit' | 'review' | 'diff';

/** Editor sends this to the agent endpoint with every message */
export interface EditorContext {
  /** Currently selected text (if any) */
  selectedText?: string;
  /** Which section the cursor is in */
  cursorSection?: ProposalField;
  /** Current content of all sections */
  currentContent: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
  /** Current editor mode */
  mode: EditorMode;
}

/** Agent proposes this edit — editor renders as inline diff */
export interface ProposedEdit {
  /** Which section to edit */
  field: ProposalField;
  /** Character offset — start of text to replace */
  anchorStart: number;
  /** Character offset — end of text to replace */
  anchorEnd: number;
  /** The original text being replaced */
  originalText: string;
  /** The proposed replacement text */
  proposedText: string;
  /** Brief explanation of the change */
  explanation: string;
}

/** Agent proposes this comment — editor renders at anchor point */
export interface ProposedComment {
  /** Which section the comment is on */
  field: AnnotatableField;
  /** Character offset — start of anchored text */
  anchorStart: number;
  /** Character offset — end of anchored text */
  anchorEnd: number;
  /** The text being commented on */
  anchorText: string;
  /** The comment content */
  commentText: string;
  /** Comment category */
  category: 'note' | 'concern' | 'question' | 'suggestion';
}
