'use client';

/**
 * ConstitutionSection — Custom Tiptap node extension for constitution article sections.
 *
 * Each constitution section (preamble, defined terms, articles, appendices) renders
 * as a labeled block with article number badge, title, character count, and amendment
 * status badge. This is a peer to SectionBlock.tsx, following the same Node.create +
 * ReactNodeViewRenderer pattern but adapted for constitution content.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import type { ReactNode } from 'react';
import type { ConstitutionNode } from '@/lib/constitution/fullText';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CHARS = 50000;

// ---------------------------------------------------------------------------
// React NodeView component
// ---------------------------------------------------------------------------

function ConstitutionSectionView({ node, editor }: NodeViewProps) {
  const field = (node.attrs.field as string) || '';
  const articleNumber = node.attrs.articleNumber as number | null;
  const title = (node.attrs.title as string) || '';
  const charCount = node.textContent?.length ?? 0;
  const isEditable = editor.isEditable;

  // Check for amendment status by scanning for diff marks in this node
  const hasAmendments = (() => {
    let found = false;
    node.descendants((child) => {
      if (found) return false;
      if (child.isText) {
        for (const mark of child.marks) {
          if (mark.type.name === 'aiDiffAdded' || mark.type.name === 'aiDiffRemoved') {
            found = true;
            return false;
          }
        }
      }
    });
    return found;
  })();

  // Character count formatting
  const isNearLimit = charCount > MAX_CHARS * 0.9;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <NodeViewWrapper
      className="constitution-section mb-4 border border-border/50 rounded-lg bg-card overflow-hidden"
      data-section-field={field}
      data-article-number={articleNumber ?? undefined}
    >
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/30 select-none">
        <div className="flex items-center gap-2">
          {/* Article number badge */}
          {articleNumber !== null && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded bg-primary/10 text-[10px] font-bold text-primary tabular-nums">
              {articleNumber}
            </span>
          )}
          {/* Title */}
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </span>
          {/* Amendment status badge */}
          {hasAmendments ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
              Amended
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted/50 text-muted-foreground/60">
              Unchanged
            </span>
          )}
          {/* Sentiment slot placeholder */}
          <span className="constitution-sentiment-slot" data-field={field} />
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
          {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
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

export interface ConstitutionSectionOptions {
  /** Sentiment slots per section (rendered in header) */
  sentimentSlots?: Record<string, ReactNode>;
}

export const ConstitutionSection = Node.create<ConstitutionSectionOptions>({
  name: 'constitutionSection',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      field: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-section-field'),
        renderHTML: (attributes) => ({
          'data-section-field': attributes.field as string,
        }),
      },
      articleNumber: {
        default: null,
        parseHTML: (element) => {
          const val = element.getAttribute('data-article-number');
          return val ? parseInt(val, 10) : null;
        },
        renderHTML: (attributes) => {
          if (attributes.articleNumber === null) return {};
          return { 'data-article-number': String(attributes.articleNumber) };
        },
      },
      sectionNumber: {
        default: null,
        parseHTML: (element) => {
          const val = element.getAttribute('data-section-number');
          return val ? parseInt(val, 10) : null;
        },
        renderHTML: (attributes) => {
          if (attributes.sectionNumber === null) return {};
          return { 'data-section-number': String(attributes.sectionNumber) };
        },
      },
      title: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-section-title'),
        renderHTML: (attributes) => ({
          'data-section-title': attributes.title as string,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-section-field][data-section-title]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'constitution-section' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ConstitutionSectionView);
  },
});

// ---------------------------------------------------------------------------
// Markdown-to-ProseMirror helpers (reused from SectionBlock pattern)
// ---------------------------------------------------------------------------

/** Parse **bold**, *italic*, and [links](url) inline markers into Tiptap mark objects. */
function parseInlineMarks(text: string): object[] {
  const result: object[] = [];
  const regex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|([^[*]+))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2] && match[3]) {
      result.push({
        type: 'text',
        text: match[2],
        marks: [{ type: 'link', attrs: { href: match[3], target: '_blank' } }],
      });
    } else if (match[4]) {
      result.push({ type: 'text', text: match[4], marks: [{ type: 'bold' }] });
    } else if (match[5]) {
      result.push({ type: 'text', text: match[5], marks: [{ type: 'italic' }] });
    } else if (match[6]) {
      result.push({ type: 'text', text: match[6] });
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

  const flushAll = () => {
    flushParagraph();
    flushBulletList();
    flushOrderedList();
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    // Headings
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

    // Ordered list items
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

    flushBulletList();
    flushOrderedList();
    currentParagraph.push(trimmed);
  }

  flushAll();

  return blocks.length > 0 ? blocks : [{ type: 'paragraph', content: [] }];
}

// ---------------------------------------------------------------------------
// buildConstitutionDocument
// ---------------------------------------------------------------------------

/**
 * Build initial editor document content from constitution nodes.
 * Each ConstitutionNode becomes a constitutionSection with its text
 * parsed from markdown into ProseMirror block nodes.
 */
export function buildConstitutionDocument(nodes: ConstitutionNode[]) {
  return {
    type: 'doc',
    content: nodes.map((node) => ({
      type: 'constitutionSection',
      attrs: {
        field: node.id,
        articleNumber: node.articleNumber,
        sectionNumber: node.sectionNumber,
        title: node.title,
      },
      content: markdownToContent(node.text),
    })),
  };
}

// ---------------------------------------------------------------------------
// extractConstitutionContent
// ---------------------------------------------------------------------------

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

/**
 * Extract text content per section ID from the editor's document.
 */
export function extractConstitutionContent(doc: { content: JsonNode[] }): Record<string, string> {
  const result: Record<string, string> = {};

  if (!doc?.content) return result;

  for (const node of doc.content) {
    if (node.type === 'constitutionSection' && node.attrs?.field) {
      const field = node.attrs.field as string;
      result[field] = extractTextFromNode(node);
    }
  }

  return result;
}
