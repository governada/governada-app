'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CardUrgency = 'default' | 'success' | 'warning' | 'critical';

const URGENCY_STYLES: Record<CardUrgency, string> = {
  default: 'border-border bg-card',
  success: 'border-emerald-500/30 bg-emerald-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  critical: 'border-red-500/30 bg-red-500/5',
};

interface HubCardProps {
  href: string;
  urgency?: CardUrgency;
  className?: string;
  children: React.ReactNode;
  /** Screen reader label for the link */
  label: string;
}

/**
 * Base Hub card wrapper.
 * Every card is a link — no dead-end cards. Conclusion + link, not a dashboard widget.
 */
export function HubCard({ href, urgency = 'default', className, children, label }: HubCardProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        'group block rounded-2xl border p-4 sm:p-5 transition-colors hover:border-primary/40',
        URGENCY_STYLES[urgency],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">{children}</div>
        <ArrowRight
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </div>
    </Link>
  );
}

/** Skeleton placeholder for a loading Hub card */
export function HubCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 animate-pulse">
      <div className="space-y-3">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-6 w-48 rounded bg-muted" />
        <div className="h-3 w-36 rounded bg-muted" />
      </div>
    </div>
  );
}

/** Error state for a Hub card — shows a brief message with retry affordance */
export function HubCardError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{message ?? 'Unable to load'}</p>
        {onRetry && (
          <button onClick={onRetry} className="text-xs text-primary hover:underline shrink-0">
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
