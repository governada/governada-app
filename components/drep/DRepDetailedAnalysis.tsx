'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DRepDetailedAnalysisProps {
  children: ReactNode;
}

/**
 * Progressive disclosure gate for DRep profile analytics sections.
 *
 * - Citizens and anonymous users see a collapsed "Show detailed analysis" toggle.
 * - DReps, SPOs, CC members, and researchers see everything expanded by default.
 * - Deep-depth citizens also see it expanded by default.
 *
 * When expanded, a sticky collapse bar appears at the top so users can easily
 * collapse and return to the core profile as they scroll through the analysis.
 */
export function DRepDetailedAnalysis({ children }: DRepDetailedAnalysisProps) {
  const { segment, isLoading } = useSegment();
  const { isAtLeast } = useGovernanceDepth();

  const isDetailedSegment = segment === 'drep' || segment === 'spo' || segment === 'cc';
  const isDeepCitizen = segment === 'citizen' && isAtLeast('deep');
  const shouldAutoExpand = isDetailedSegment || isDeepCitizen;

  // User toggle: null = not yet toggled by user, use segment-derived default
  const [userToggled, setUserToggled] = useState<boolean | null>(null);

  // Track whether the expand button has scrolled out of view
  const [showStickyCollapse, setShowStickyCollapse] = useState(false);
  const gateRef = useRef<HTMLDivElement>(null);

  // Derived expanded state: user toggle wins, else expand for confirmed detailed segments or deep citizens
  const expanded = userToggled !== null ? userToggled : !isLoading && shouldAutoExpand;

  // IntersectionObserver to show sticky collapse when the gate top scrolls out of viewport
  useEffect(() => {
    if (!expanded || !gateRef.current) {
      setShowStickyCollapse(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky bar when the gate origin is above the viewport
        setShowStickyCollapse(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '0px' },
    );

    observer.observe(gateRef.current);
    return () => observer.disconnect();
  }, [expanded]);

  const handleCollapse = () => {
    setUserToggled(false);
    // Scroll back to the gate origin so user returns to profile core
    gateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // For confirmed detailed segments or deep citizens, render children directly (no gate)
  if (!isLoading && shouldAutoExpand) {
    return <>{children}</>;
  }

  // Citizens, anonymous, and loading state: show collapsed gate (stable layout)
  return (
    <div className="space-y-4" ref={gateRef}>
      {!expanded && (
        <div className="flex justify-center py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUserToggled(true)}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <span>Show detailed analysis</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          expanded ? 'opacity-100' : 'max-h-0 overflow-hidden opacity-0',
        )}
      >
        {expanded && (
          <>
            {/* Sticky collapse bar — appears when user scrolls past the gate origin */}
            <div
              className={cn(
                'sticky top-0 z-30 flex justify-center py-2 transition-all duration-200',
                showStickyCollapse
                  ? 'opacity-100 translate-y-0 pointer-events-auto bg-background/80 backdrop-blur-md border-b border-border/50'
                  : 'opacity-0 -translate-y-2 pointer-events-none',
              )}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCollapse}
                className="gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronUp className="h-4 w-4" />
                <span>Collapse detailed analysis</span>
              </Button>
            </div>

            <div className="space-y-6">{children}</div>
          </>
        )}
      </div>

      {expanded && (
        <div className="flex justify-center py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCollapse}
            className="gap-2 text-xs text-muted-foreground"
          >
            <span>Hide detailed analysis</span>
            <ChevronDown className="h-4 w-4 rotate-180" />
          </Button>
        </div>
      )}
    </div>
  );
}
