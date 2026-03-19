'use client';

/**
 * CitedClaim — Perplexity-style inline source citation.
 *
 * Every AI claim in the intelligence panel should use this component
 * to link back to the source data, providing a provenance chain:
 * data -> reasoning -> conclusion.
 */

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Citation {
  /** Display label for the citation (e.g., "On-chain data", "AI Analysis") */
  label: string;
  /** Link to the source (page or API) */
  href?: string;
}

interface CitedClaimProps {
  /** The claim text */
  children: React.ReactNode;
  /** Source citations */
  citations: Citation[];
  /** Additional class names */
  className?: string;
}

export function CitedClaim({ children, citations, className }: CitedClaimProps) {
  if (citations.length === 0) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className={cn('inline', className)}>
      {children}
      {citations.map((cite, i) => (
        <sup key={i} className="inline-flex ml-0.5">
          {cite.href ? (
            <Link
              href={cite.href}
              className={cn(
                'inline-flex items-center justify-center',
                'min-w-[14px] h-[14px] px-0.5 rounded-sm',
                'text-[9px] font-medium leading-none',
                'bg-primary/15 text-primary hover:bg-primary/25',
                'transition-colors no-underline',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
              )}
              title={cite.label}
            >
              {i + 1}
            </Link>
          ) : (
            <span
              className={cn(
                'inline-flex items-center justify-center',
                'min-w-[14px] h-[14px] px-0.5 rounded-sm',
                'text-[9px] font-medium leading-none',
                'bg-muted/50 text-muted-foreground',
              )}
              title={cite.label}
            >
              {i + 1}
            </span>
          )}
        </sup>
      ))}
    </span>
  );
}
