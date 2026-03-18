'use client';

/**
 * SectionBlock — Custom Tiptap node extension for labeled proposal sections.
 *
 * Each section (title, abstract, motivation, rationale) renders as a labeled
 * block with a metadata header showing section name, character count, and a
 * health badge slot.
 *
 * This is a Tiptap Node extension that wraps content in a section container
 * with its own header UI. The section is identified by its `field` attribute.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import type { ProposalField } from '@/lib/workspace/editor/types';

// ---------------------------------------------------------------------------
// Section metadata configuration
// ---------------------------------------------------------------------------

const SECTION_CONFIG: Record<
  ProposalField,
  { label: string; maxChars: number; placeholder: string }
> = {
  title: {
    label: 'Title',
    maxChars: 200,
    placeholder: 'Proposal title...',
  },
  abstract: {
    label: 'Abstract',
    maxChars: 2000,
    placeholder: 'Brief summary of what this proposal does...',
  },
  motivation: {
    label: 'Motivation',
    maxChars: 10000,
    placeholder: 'Why is this proposal needed? What problem does it solve?',
  },
  rationale: {
    label: 'Rationale',
    maxChars: 10000,
    placeholder: 'Why is this the right approach? Why should DReps vote Yes?',
  },
};

// ---------------------------------------------------------------------------
// React NodeView component
// ---------------------------------------------------------------------------

interface SectionBlockViewProps extends NodeViewProps {
  /** Optional health badge render callback */
  healthBadge?: (field: ProposalField) => React.ReactNode;
}

function SectionBlockView({ node, editor }: SectionBlockViewProps) {
  const field = (node.attrs.field as ProposalField) || 'abstract';
  const config = SECTION_CONFIG[field] || SECTION_CONFIG.abstract;

  // Calculate character count from the node's text content
  const charCount = node.textContent?.length ?? 0;
  const isNearLimit = charCount > config.maxChars * 0.9;
  const isOverLimit = charCount > config.maxChars;
  const isEditable = editor.isEditable;

  return (
    <NodeViewWrapper
      className="section-block mb-4 border border-border/50 rounded-lg bg-card overflow-hidden"
      data-section-field={field}
    >
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/30 select-none">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {config.label}
          </span>
          {/* Health badge slot — rendered by parent via extension storage */}
          <span className="section-health-badge" data-field={field} />
        </div>
        <span
          className={`text-[10px] tabular-nums transition-colors ${
            isOverLimit
              ? 'text-red-500 dark:text-red-400 font-medium'
              : isNearLimit
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground/60'
          }`}
        >
          {charCount.toLocaleString()} / {config.maxChars.toLocaleString()}
        </span>
      </div>

      {/* Editor content area */}
      <NodeViewContent
        className={`prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[60px] px-4 py-3 ${
          !isEditable ? 'cursor-default' : ''
        }`}
        as="div"
      />
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------------------
// Tiptap Node extension
// ---------------------------------------------------------------------------

export interface SectionBlockOptions {
  /** Callback when health badge should be rendered */
  onHealthBadge?: (field: ProposalField) => React.ReactNode;
}

export const SectionBlock = Node.create<SectionBlockOptions>({
  name: 'sectionBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      field: {
        default: 'abstract',
        parseHTML: (element) => element.getAttribute('data-section-field'),
        renderHTML: (attributes) => ({
          'data-section-field': attributes.field as string,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-section-field]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'section-block' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SectionBlockView);
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Markdown-to-ProseMirror helpers (for read-only rendering)
// ---------------------------------------------------------------------------

/** Parse **bold** and *italic* inline markers into Tiptap mark objects. */
function parseInlineMarks(text: string): object[] {
  const result: object[] = [];
  // Match **bold**, *italic*, or plain text segments
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      result.push({ type: 'text', text: match[2], marks: [{ type: 'bold' }] });
    } else if (match[3]) {
      result.push({ type: 'text', text: match[3], marks: [{ type: 'italic' }] });
    } else if (match[4]) {
      result.push({ type: 'text', text: match[4] });
    }
  }

  return result.length > 0 ? result : [{ type: 'text', text }];
}

/** Convert a plain-text markdown string into ProseMirror-compatible block nodes. */
function markdownToContent(text: string): object[] {
  if (!text) return [{ type: 'paragraph', content: [] }];

  const blocks: object[] = [];
  const lines = text.split('\n');
  let currentParagraph: string[] = [];
  let pendingListItems: object[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const joined = currentParagraph.join('\n');
      if (joined.trim()) {
        blocks.push({
          type: 'paragraph',
          content: parseInlineMarks(joined.trim()),
        });
      }
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (pendingListItems.length > 0) {
      blocks.push({ type: 'bulletList', content: pendingListItems });
      pendingListItems = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty line = paragraph break
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    // Bullet list items
    if (/^[-*]\s/.test(trimmed)) {
      flushParagraph();
      pendingListItems.push({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: parseInlineMarks(trimmed.replace(/^[-*]\s/, '')),
          },
        ],
      });
      continue;
    }

    // Regular text — if we had pending list items, flush them first
    flushList();
    currentParagraph.push(trimmed);
  }
  flushParagraph();
  flushList();

  return blocks.length > 0 ? blocks : [{ type: 'paragraph', content: [] }];
}

// ---------------------------------------------------------------------------
// buildSectionDocument
// ---------------------------------------------------------------------------

/**
 * Build initial editor document content with section blocks.
 * Each field becomes a sectionBlock node with paragraph children.
 *
 * When `parseMarkdown` is true (typically in read-only/review mode),
 * markdown formatting (bold, italic, bullet lists) is converted into
 * proper ProseMirror nodes so the editor renders them visually.
 */
export function buildSectionDocument(
  content: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  },
  options?: { excludeFields?: ProposalField[]; parseMarkdown?: boolean },
) {
  const fields: ProposalField[] = (
    ['title', 'abstract', 'motivation', 'rationale'] as const
  ).filter((f) => !options?.excludeFields?.includes(f));

  return {
    type: 'doc',
    content: fields.map((field) => ({
      type: 'sectionBlock',
      attrs: { field },
      content: options?.parseMarkdown
        ? markdownToContent(content[field])
        : [
            {
              type: 'paragraph',
              content: content[field] ? [{ type: 'text', text: content[field] }] : [],
            },
          ],
    })),
  };
}

/**
 * Extract text content per section from the editor's document.
 */
export function extractSectionContent(doc: { content: JsonNode[] }): Record<ProposalField, string> {
  const result: Record<ProposalField, string> = {
    title: '',
    abstract: '',
    motivation: '',
    rationale: '',
  };

  if (!doc?.content) return result;

  for (const node of doc.content) {
    if (node.type === 'sectionBlock' && node.attrs?.field) {
      const field = node.attrs.field as ProposalField;
      // Extract text from all child nodes
      result[field] = extractTextFromNode(node);
    }
  }

  return result;
}

type JsonNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
};

/** Recursively extract plain text from a ProseMirror-like node tree */
function extractTextFromNode(node: JsonNode): string {
  if (node.text) return node.text;
  if (!node.content) return '';
  return node.content
    .map((child) => extractTextFromNode(child))
    .join(node.type === 'paragraph' ? '\n' : '');
}

export { SECTION_CONFIG };
