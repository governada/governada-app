'use client';

/**
 * PanelSkeleton — Loading skeleton for panel content.
 *
 * Renders a configurable number of section placeholders
 * with animation to indicate loading state.
 */

interface PanelSkeletonProps {
  /** Number of section skeletons to render */
  sections?: number;
}

export function PanelSkeleton({ sections = 2 }: PanelSkeletonProps) {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading intelligence briefing">
      {Array.from({ length: sections }, (_, i) => (
        <div key={i} className="border-b border-border/10 last:border-b-0 p-3 space-y-2">
          {/* Title bar */}
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-3.5 rounded bg-muted/15" />
            <div className="h-3 bg-muted/20 rounded w-24" />
          </div>
          {/* Content lines */}
          <div className="space-y-1.5 pl-5">
            <div className="h-2.5 bg-muted/15 rounded w-full" />
            <div className="h-2.5 bg-muted/15 rounded w-3/4" />
            {i === 0 && <div className="h-2.5 bg-muted/15 rounded w-1/2" />}
          </div>
        </div>
      ))}
    </div>
  );
}
