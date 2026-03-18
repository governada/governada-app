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
        className={`governance-prose max-w-none focus:outline-none min-h-[60px] px-4 py-3 ${
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

/** Parse **bold**, *italic*, and [links](url) inline markers into Tiptap mark objects. */
function parseInlineMarks(text: string): object[] {
  const result: object[] = [];
  // Match ![image](url), [link](url), **bold**, *italic*, or plain text
  const regex =
    /(!\[([^\]]*?)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|([^[!*]+))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[1] && match[1].startsWith('!')) {
      // Image: ![alt](url)
      result.push({ type: 'image', attrs: { src: match[3], alt: match[2] || '' } });
    } else if (match[4] && match[5]) {
      // Link: [text](url)
      result.push({
        type: 'text',
        text: match[4],
        marks: [{ type: 'link', attrs: { href: match[5], target: '_blank' } }],
      });
    } else if (match[6]) {
      result.push({ type: 'text', text: match[6], marks: [{ type: 'bold' }] });
    } else if (match[7]) {
      result.push({ type: 'text', text: match[7], marks: [{ type: 'italic' }] });
    } else if (match[8]) {
      result.push({ type: 'text', text: match[8] });
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
  let pendingBulletItems: object[] = [];
  let pendingOrderedItems: object[] = [];
  let pendingBlockquoteLines: string[] = [];
  let pendingTaskItems: object[] = [];
  let pendingTableRows: object[] | null = null;
  let pendingTableIsHeader = false;

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      // Each line becomes its own paragraph for proper visual spacing.
      // Governance proposals use single newlines between distinct thoughts/sections,
      // so paragraph-level spacing (margins) is more readable than <br> line breaks.
      for (const line of currentParagraph) {
        const text = line.trim();
        if (text) {
          blocks.push({ type: 'paragraph', content: parseInlineMarks(text) });
        }
      }
      currentParagraph = [];
    }
  };

  const flushBulletList = () => {
    if (pendingBulletItems.length > 0) {
      blocks.push({ type: 'bulletList', content: pendingBulletItems });
      pendingBulletItems = [];
    }
  };

  const flushOrderedList = () => {
    if (pendingOrderedItems.length > 0) {
      blocks.push({ type: 'orderedList', content: pendingOrderedItems });
      pendingOrderedItems = [];
    }
  };

  const flushTaskList = () => {
    if (pendingTaskItems.length > 0) {
      blocks.push({ type: 'taskList', content: pendingTaskItems });
      pendingTaskItems = [];
    }
  };

  const flushBlockquote = () => {
    if (pendingBlockquoteLines.length > 0) {
      const quoteText = pendingBlockquoteLines.join(' ');
      blocks.push({
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: parseInlineMarks(quoteText.trim()),
          },
        ],
      });
      pendingBlockquoteLines = [];
    }
  };

  const flushAll = () => {
    flushParagraph();
    flushBulletList();
    flushOrderedList();
    flushTaskList();
    flushBlockquote();
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty line = paragraph break
    if (!trimmed) {
      flushAll();
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushAll();
      blocks.push({ type: 'horizontalRule' });
      continue;
    }

    // Standalone image: ![alt](url)
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      flushAll();
      blocks.push({ type: 'image', attrs: { src: imageMatch[2], alt: imageMatch[1] || '' } });
      continue;
    }

    // Headings (# through ######)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushAll();
      blocks.push({
        type: 'heading',
        attrs: { level: headingMatch[1].length },
        content: parseInlineMarks(headingMatch[2]),
      });
      continue;
    }

    // Blockquote lines (> text)
    if (trimmed.startsWith('> ') || trimmed === '>') {
      flushParagraph();
      flushBulletList();
      flushOrderedList();
      pendingBlockquoteLines.push(trimmed.replace(/^>\s?/, ''));
      continue;
    }

    // If we had blockquote lines but this line doesn't start with >, flush them
    flushBlockquote();

    // Ordered list items (1. text, 2. text, etc.)
    if (/^\d+\.\s/.test(trimmed)) {
      flushParagraph();
      flushBulletList();
      pendingOrderedItems.push({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: parseInlineMarks(trimmed.replace(/^\d+\.\s/, '')),
          },
        ],
      });
      continue;
    }

    // Task list items: - [x] or - [ ] text
    const taskMatch = trimmed.match(/^[-*]\s\[([ xX])\]\s+(.+)$/);
    if (taskMatch) {
      flushParagraph();
      flushBulletList();
      flushOrderedList();
      pendingTaskItems.push({
        type: 'taskItem',
        attrs: { checked: taskMatch[1].toLowerCase() === 'x' },
        content: [
          {
            type: 'paragraph',
            content: parseInlineMarks(taskMatch[2]),
          },
        ],
      });
      continue;
    }

    // If we had pending task items but this isn't one, flush them
    if (pendingTaskItems.length > 0) {
      blocks.push({ type: 'taskList', content: pendingTaskItems });
      pendingTaskItems = [];
    }

    // Bullet list items
    if (/^[-*]\s/.test(trimmed)) {
      flushParagraph();
      flushOrderedList();
      pendingBulletItems.push({
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

    // Table rows (| col | col |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const isSeparator = /^\|[\s:]*-+[\s:]*(?:\|[\s:]*-+[\s:]*)*\|$/.test(trimmed);
      if (!isSeparator) {
        flushParagraph();
        flushBulletList();
        flushOrderedList();
        const cells = trimmed
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());

        if (!pendingTableRows) {
          pendingTableRows = [];
          pendingTableIsHeader = true;
        }

        const isHeader = pendingTableIsHeader && pendingTableRows.length === 0;
        const cellType = isHeader ? 'tableHeader' : 'tableCell';

        pendingTableRows.push({
          type: 'tableRow',
          content: cells.map((cell) => ({
            type: cellType,
            content: [
              {
                type: 'paragraph',
                content: cell ? parseInlineMarks(cell) : [],
              },
            ],
          })),
        });
      } else {
        pendingTableIsHeader = false;
      }
      continue;
    }

    // Flush pending table if this line is not a table row
    if (pendingTableRows && pendingTableRows.length > 0) {
      blocks.push({ type: 'table', content: pendingTableRows });
      pendingTableRows = null;
      pendingTableIsHeader = false;
    }

    // Regular text — if we had pending list items, flush them first
    flushBulletList();
    flushOrderedList();
    currentParagraph.push(trimmed);
  }
  // Flush any remaining table
  if (pendingTableRows && pendingTableRows.length > 0) {
    blocks.push({ type: 'table', content: pendingTableRows });
    pendingTableRows = null;
  }

  flushAll();

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
 * markdown formatting (bold, italic, bullet lists, headings, blockquotes,
 * links, ordered lists, horizontal rules) is converted into proper
 * ProseMirror nodes so the editor renders them visually.
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
