import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';

/**
 * MarkdownRenderer snapshot + structure tests.
 * Verify that the .governance-prose class is applied and that each
 * content type renders the expected HTML structure.
 */

describe('MarkdownRenderer', () => {
  test('renders null for empty content', () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container.innerHTML).toBe('');
  });

  test('applies governance-prose class to wrapper', () => {
    const { container } = render(<MarkdownRenderer content="Hello" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.classList.contains('governance-prose')).toBe(true);
  });

  test('renders paragraph text', () => {
    render(<MarkdownRenderer content="Simple paragraph text." />);
    expect(screen.getByText('Simple paragraph text.')).toBeDefined();
  });

  test('renders headings at correct levels', () => {
    const { container } = render(
      <MarkdownRenderer content={'# Heading 1\n## Heading 2\n### Heading 3'} />,
    );
    expect(container.querySelector('h1')?.textContent).toBe('Heading 1');
    expect(container.querySelector('h2')?.textContent).toBe('Heading 2');
    expect(container.querySelector('h3')?.textContent).toBe('Heading 3');
  });

  test('renders bold and italic text', () => {
    const { container } = render(<MarkdownRenderer content="**bold** and *italic*" />);
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
  });

  test('renders bullet list', () => {
    const { container } = render(<MarkdownRenderer content={'- Item A\n- Item B\n- Item C'} />);
    const list = container.querySelector('ul');
    expect(list).toBeDefined();
    expect(list?.querySelectorAll('li').length).toBe(3);
  });

  test('renders ordered list', () => {
    const { container } = render(<MarkdownRenderer content={'1. First\n2. Second'} />);
    const list = container.querySelector('ol');
    expect(list).toBeDefined();
    expect(list?.querySelectorAll('li').length).toBe(2);
  });

  test('renders blockquote', () => {
    const { container } = render(<MarkdownRenderer content="> A quoted passage" />);
    expect(container.querySelector('blockquote')).toBeDefined();
  });

  test('renders Note callout with data-callout attribute', () => {
    const { container } = render(<MarkdownRenderer content="> **Note:** This is a note callout" />);
    const bq = container.querySelector('blockquote');
    expect(bq?.getAttribute('data-callout')).toBe('note');
  });

  test('renders Warning callout with data-callout attribute', () => {
    const { container } = render(<MarkdownRenderer content="> **Warning:** Be careful here" />);
    const bq = container.querySelector('blockquote');
    expect(bq?.getAttribute('data-callout')).toBe('warning');
  });

  test('renders Important callout with data-callout attribute', () => {
    const { container } = render(
      <MarkdownRenderer content="> **Important:** Critical information" />,
    );
    const bq = container.querySelector('blockquote');
    expect(bq?.getAttribute('data-callout')).toBe('important');
  });

  test('regular blockquote has no data-callout attribute', () => {
    const { container } = render(<MarkdownRenderer content="> Just a normal quote" />);
    const bq = container.querySelector('blockquote');
    expect(bq?.hasAttribute('data-callout')).toBe(false);
  });

  test('renders inline code', () => {
    const { container } = render(<MarkdownRenderer content="Use `code` here" />);
    expect(container.querySelector('code')?.textContent).toBe('code');
  });

  test('renders code block', () => {
    const { container } = render(<MarkdownRenderer content={'```\nconst x = 1;\n```'} />);
    expect(container.querySelector('pre')).toBeDefined();
    expect(container.querySelector('pre code')).toBeDefined();
  });

  test('renders table with header and body', () => {
    const { container } = render(
      <MarkdownRenderer content={'| H1 | H2 |\n| -- | -- |\n| A | B |'} />,
    );
    expect(container.querySelector('table')).toBeDefined();
    expect(container.querySelector('th')?.textContent).toBe('H1');
    expect(container.querySelector('td')?.textContent).toBe('A');
  });

  test('renders horizontal rule', () => {
    const { container } = render(<MarkdownRenderer content={'Above\n\n---\n\nBelow'} />);
    expect(container.querySelector('hr')).toBeDefined();
  });

  test('renders links with target=_blank', () => {
    const { container } = render(<MarkdownRenderer content="[Governada](https://governada.io)" />);
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://governada.io');
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  test('renders strikethrough text', () => {
    const { container } = render(<MarkdownRenderer content="~~deleted~~" />);
    expect(container.querySelector('del')?.textContent).toBe('deleted');
  });

  test('compact mode adds text-sm class', () => {
    const { container } = render(<MarkdownRenderer content="Text" compact />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.classList.contains('text-sm')).toBe(true);
  });

  test('custom className is applied', () => {
    const { container } = render(<MarkdownRenderer content="Text" className="custom-class" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.classList.contains('custom-class')).toBe(true);
  });
});
