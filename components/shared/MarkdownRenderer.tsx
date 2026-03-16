'use client';

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
 * Shared markdown renderer with GFM support (tables, checklists, strikethrough).
 * Uses custom components for consistent styling in light and dark modes.
 */
export function MarkdownRenderer({ content, className, compact }: MarkdownRendererProps) {
  if (!content) return null;

  return (
    <div
      className={cn(
        'max-w-none',
        compact ? 'text-sm' : 'text-base',
        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:opacity-80"
            >
              {children}
            </a>
          ),
          p: ({ children }) => (
            <p className={cn('mb-3 last:mb-0 text-foreground/90', compact && 'mb-2')}>{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-foreground/90">{children}</li>,
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-foreground mb-3 mt-6 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-foreground mb-2 mt-5 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-foreground mb-2 mt-4 first:mt-0">
              {children}
            </h3>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/30 pl-4 my-3 text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="bg-muted rounded px-1.5 py-0.5 text-sm font-mono">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="bg-muted rounded-lg p-4 overflow-x-auto my-3 text-sm">{children}</pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-3 py-2 text-left font-semibold bg-muted/50">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border border-border px-3 py-2">{children}</td>,
          hr: () => <hr className="border-border my-4" />,
          // GFM checkbox support
          input: ({ type, checked, ...rest }) =>
            type === 'checkbox' ? (
              <input
                type="checkbox"
                checked={checked}
                readOnly
                className="accent-primary mr-2 align-middle"
                {...rest}
              />
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
