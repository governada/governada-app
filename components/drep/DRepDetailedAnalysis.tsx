'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
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
 *
 * Defaults to collapsed to avoid CLS — expands only after segment confirms
 * the user is a governance participant.
 */
export function DRepDetailedAnalysis({ children }: DRepDetailedAnalysisProps) {
  const { segment, isLoading } = useSegment();

  const isDetailedSegment = segment === 'drep' || segment === 'spo' || segment === 'cc';

  // User toggle: null = not yet toggled by user, use segment-derived default
  const [userToggled, setUserToggled] = useState<boolean | null>(null);

  // Derived expanded state: user toggle wins, else expand for confirmed detailed segments
  const expanded = userToggled !== null ? userToggled : !isLoading && isDetailedSegment;

  // For confirmed detailed segments, render children directly (no gate)
  if (!isLoading && isDetailedSegment) {
    return <>{children}</>;
  }

  // Citizens, anonymous, and loading state: show collapsed gate (stable layout)
  return (
    <div className="space-y-4">
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
        {expanded && <div className="space-y-6">{children}</div>}
      </div>

      {expanded && (
        <div className="flex justify-center py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUserToggled(false)}
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
