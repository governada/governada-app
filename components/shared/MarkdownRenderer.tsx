'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /** Compact mode reduces spacing for inline/sidebar use */
  compact?: boolean;
}

/**
 * Detect callout type from blockquote content.
 * Looks for opening bold markers: **Note:**, **Warning:**, **Important:**
 *
 * react-markdown wraps blockquote children with whitespace text nodes,
 * so we find the first actual element (a <p>) and inspect its first child.
 */
function detectCalloutType(children: React.ReactNode): string | null {
  const childArray = React.Children.toArray(children);
  if (childArray.length === 0) return null;

  // Find the first React element child (skip whitespace text nodes)
  const firstElement = childArray.find((child) => React.isValidElement(child));
  if (!firstElement || !React.isValidElement(firstElement)) return null;

  // Get the text content of the first paragraph
  const pChildren = React.Children.toArray(
    (firstElement.props as { children?: React.ReactNode }).children,
  );
  if (pChildren.length === 0) return null;

  // Find the first strong element inside the paragraph
  const firstStrong = pChildren.find(
    (child) => React.isValidElement(child) && child.type === 'strong',
  );
  if (!firstStrong || !React.isValidElement(firstStrong)) return null;

  const strongText = String(
    React.Children.toArray((firstStrong.props as { children?: React.ReactNode }).children).join(''),
  ).toLowerCase();

  if (strongText.startsWith('note')) return 'note';
  if (strongText.startsWith('warning')) return 'warning';
  if (strongText.startsWith('important')) return 'important';

  return null;
}

/**
 * Shared markdown renderer with GFM support (tables, checklists, strikethrough).
 * Uses the .governance-prose CSS class for consistent styling, with minimal
 * React component overrides only where React behavior is needed.
 */
export function MarkdownRenderer({ content, className, compact }: MarkdownRendererProps) {
  if (!content) return null;

  return (
    <div
      className={cn(
        'governance-prose max-w-none',
        compact ? 'text-sm' : 'text-base',
        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Links need target="_blank" for external navigation
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          // Blockquotes need callout detection for data-callout attribute
          blockquote: ({ children }) => {
            const calloutType = detectCalloutType(children);
            return <blockquote data-callout={calloutType || undefined}>{children}</blockquote>;
          },
          // Tables need overflow wrapper
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
          // GFM checkbox support
          input: ({ type, checked, ...rest }) =>
            type === 'checkbox' ? (
              <input type="checkbox" checked={checked} readOnly {...rest} />
            ) : (
              <input type={type} {...rest} />
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
