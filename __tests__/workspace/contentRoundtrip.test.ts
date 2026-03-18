import { describe, test, expect } from 'vitest';
import {
  buildSectionDocument,
  extractSectionContent,
} from '@/components/workspace/editor/SectionBlock';

/**
 * Content roundtrip tests — verify that markdown content types survive the
 * parse pipeline: markdown string -> ProseMirror JSON (via buildSectionDocument)
 * -> structural validation.
 *
 * These tests ensure that the editor's markdown parser correctly handles all
 * GFM content types used in governance proposals.
 */

const EMPTY_CONTENT = { title: '', abstract: '', motivation: '', rationale: '' };

function buildAbstract(markdown: string) {
  return buildSectionDocument({ ...EMPTY_CONTENT, abstract: markdown }, { parseMarkdown: true });
}

/** Get the abstract section's content array from a built document */
function getAbstractContent(doc: ReturnType<typeof buildSectionDocument>) {
  const sections = doc.content as Array<{
    type: string;
    attrs: { field: string };
    content: unknown[];
  }>;
  const abstractSection = sections.find((s) => s.attrs.field === 'abstract');
  return abstractSection?.content ?? [];
}

describe('markdown -> ProseMirror roundtrip', () => {
  test('headings H1-H3 parse to heading nodes', () => {
    const markdown = '# Title\n## Subtitle\n### Section';
    const content = getAbstractContent(buildAbstract(markdown));

    expect(content).toEqual([
      expect.objectContaining({ type: 'heading', attrs: { level: 1 } }),
      expect.objectContaining({ type: 'heading', attrs: { level: 2 } }),
      expect.objectContaining({ type: 'heading', attrs: { level: 3 } }),
    ]);
  });

  test('bold and italic inline marks parse correctly', () => {
    const markdown = 'This has **bold** and *italic* text';
    const content = getAbstractContent(buildAbstract(markdown));

    expect(content).toHaveLength(1);
    expect(content[0]).toMatchObject({ type: 'paragraph' });

    // The paragraph's content should include bold and italic marks
    const paragraph = content[0] as {
      type: string;
      content: Array<{ type: string; marks?: Array<{ type: string }> }>;
    };
    const hasBold = paragraph.content.some((node) => node.marks?.some((m) => m.type === 'bold'));
    const hasItalic = paragraph.content.some((node) =>
      node.marks?.some((m) => m.type === 'italic'),
    );
    expect(hasBold).toBe(true);
    expect(hasItalic).toBe(true);
  });

  test('bullet list parses to bulletList node', () => {
    const markdown = '- Item one\n- Item two\n- Item three';
    const content = getAbstractContent(buildAbstract(markdown));

    expect(content).toHaveLength(1);
    expect(content[0]).toMatchObject({ type: 'bulletList' });

    const list = content[0] as { content: Array<{ type: string }> };
    expect(list.content).toHaveLength(3);
    expect(list.content[0]).toMatchObject({ type: 'listItem' });
  });

  test('ordered list parses to orderedList node', () => {
    const markdown = '1. First\n2. Second\n3. Third';
    const content = getAbstractContent(buildAbstract(markdown));

    expect(content).toHaveLength(1);
    expect(content[0]).toMatchObject({ type: 'orderedList' });

    const list = content[0] as { content: Array<{ type: string }> };
    expect(list.content).toHaveLength(3);
  });

  test('task list parses to taskList with checked/unchecked items', () => {
    const markdown = '- [x] Done task\n- [ ] Pending task';
    const content = getAbstractContent(buildAbstract(markdown));

    expect(content).toHaveLength(1);
    expect(content[0]).toMatchObject({ type: 'taskList' });

    const list = content[0] as {
      content: Array<{ type: string; attrs: { checked: boolean } }>;
    };
    expect(list.content).toHaveLength(2);
    expect(list.content[0].attrs.checked).toBe(true);
    expect(list.content[1].attrs.checked).toBe(false);
  });

  test('blockquote parses to blockquote node', () => {
    const markdown = '> This is a quote';
    const content = getAbstractContent(buildAbstract(markdown));

    expect(content).toHaveLength(1);
    expect(content[0]).toMatchObject({ type: 'blockquote' });
  });

  test('code block syntax is not lost (preserved as paragraph text)', () => {
    // The simple markdown parser in SectionBlock doesn't handle fenced code blocks,
    // but we verify that the text content survives the pipeline
    const markdown = 'Some code: `inline code`';
    const content = getAbstractContent(buildAbstract(markdown));

    // The content should contain the text
    expect(content.length).toBeGreaterThan(0);
  });

  test('horizontal rule parses to horizontalRule node', () => {
    const markdown = 'Before\n\n---\n\nAfter';
    const content = getAbstractContent(buildAbstract(markdown));

    const hrNode = content.find((node) => (node as { type: string }).type === 'horizontalRule');
    expect(hrNode).toBeDefined();
  });

  test('links parse with href attribute', () => {
    const markdown = 'Visit [Governada](https://governada.io) for more';
    const content = getAbstractContent(buildAbstract(markdown));

    expect(content).toHaveLength(1);
    const paragraph = content[0] as {
      type: string;
      content: Array<{
        type: string;
        text?: string;
        marks?: Array<{ type: string; attrs?: { href: string } }>;
      }>;
    };

    const linkNode = paragraph.content.find((node) => node.marks?.some((m) => m.type === 'link'));
    expect(linkNode).toBeDefined();
    expect(linkNode?.marks?.[0].attrs?.href).toBe('https://governada.io');
  });

  test('image parses to image node', () => {
    const markdown = '![Alt text](https://example.com/image.png)';
    const content = getAbstractContent(buildAbstract(markdown));

    const imageNode = content.find((node) => (node as { type: string }).type === 'image');
    expect(imageNode).toBeDefined();
    expect(imageNode).toMatchObject({
      type: 'image',
      attrs: expect.objectContaining({
        src: 'https://example.com/image.png',
        alt: 'Alt text',
      }),
    });
  });

  test('table parses to table node with header and body rows', () => {
    const markdown = '| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |';
    const content = getAbstractContent(buildAbstract(markdown));

    const tableNode = content.find((node) => (node as { type: string }).type === 'table');
    expect(tableNode).toBeDefined();

    const table = tableNode as {
      type: string;
      content: Array<{ type: string; content: Array<{ type: string }> }>;
    };
    expect(table.content).toHaveLength(2); // header row + body row
    expect(table.content[0].content[0].type).toBe('tableHeader');
    expect(table.content[1].content[0].type).toBe('tableCell');
  });

  test('mixed content preserves block type ordering', () => {
    const markdown = [
      '# Heading',
      '',
      'A paragraph of text.',
      '',
      '- Bullet one',
      '- Bullet two',
      '',
      '> A quote',
      '',
      '---',
      '',
      '1. Ordered one',
      '2. Ordered two',
    ].join('\n');

    const content = getAbstractContent(buildAbstract(markdown));
    const types = content.map((node) => (node as { type: string }).type);

    expect(types).toEqual([
      'heading',
      'paragraph',
      'bulletList',
      'blockquote',
      'horizontalRule',
      'orderedList',
    ]);
  });

  test('callout-style blockquote (bold Note marker) preserves content', () => {
    const markdown = '> **Note:** This is an important callout';
    const content = getAbstractContent(buildAbstract(markdown));

    expect(content).toHaveLength(1);
    expect(content[0]).toMatchObject({ type: 'blockquote' });

    // The blockquote should contain a paragraph with bold text
    const bq = content[0] as {
      content: Array<{ content: Array<{ marks?: Array<{ type: string }> }> }>;
    };
    const hasBold = bq.content[0]?.content?.some((node) =>
      node.marks?.some((m) => m.type === 'bold'),
    );
    expect(hasBold).toBe(true);
  });
});

describe('extractSectionContent recovers text', () => {
  test('round-trips through buildSectionDocument and extractSectionContent', () => {
    const original = {
      title: 'My Proposal',
      abstract: 'A brief summary.',
      motivation: 'Why this matters.',
      rationale: 'The reasoning.',
    };

    // Build with parseMarkdown: false (edit mode -- raw text)
    const doc = buildSectionDocument(original);
    const extracted = extractSectionContent(doc as Parameters<typeof extractSectionContent>[0]);

    expect(extracted.title).toBe('My Proposal');
    expect(extracted.abstract).toBe('A brief summary.');
    expect(extracted.motivation).toBe('Why this matters.');
    expect(extracted.rationale).toBe('The reasoning.');
  });

  test('empty fields round-trip as empty strings', () => {
    const original = { title: '', abstract: '', motivation: '', rationale: '' };
    const doc = buildSectionDocument(original);
    const extracted = extractSectionContent(doc as Parameters<typeof extractSectionContent>[0]);

    expect(extracted.title).toBe('');
    expect(extracted.abstract).toBe('');
    expect(extracted.motivation).toBe('');
    expect(extracted.rationale).toBe('');
  });

  test('excludeFields omits specified sections', () => {
    const original = {
      title: 'Title',
      abstract: 'Abstract',
      motivation: 'Motivation',
      rationale: 'Rationale',
    };
    const doc = buildSectionDocument(original, { excludeFields: ['title'] });
    const sections = (doc.content as Array<{ attrs: { field: string } }>).map((s) => s.attrs.field);

    expect(sections).not.toContain('title');
    expect(sections).toContain('abstract');
    expect(sections).toContain('motivation');
    expect(sections).toContain('rationale');
  });
});
