'use client';

import { useUser } from '@/hooks/queries';
import { useSegment } from '@/components/providers/SegmentProvider';
import {
  type GovernanceDepth,
  getDefaultDepthForSegment,
  getTunerLevel,
  isValidDepth,
  type TunerLevel,
} from '@/lib/governanceTuner';

export interface GovernanceDepthState {
  /** Active depth: View As override → user preference → segment default */
  depth: GovernanceDepth;
  /** Full level config for the active depth */
  level: TunerLevel;
  /** Numeric order (0-3) for comparison operators */
  order: number;
  /** Whether this is the segment default (user hasn't explicitly chosen) */
  isDefault: boolean;
  /** Convenience: depth >= threshold */
  isAtLeast: (threshold: GovernanceDepth) => boolean;
}

export function useGovernanceDepth(): GovernanceDepthState {
  const { segment, getGovernanceDepthOverride } = useSegment();
  const { data: rawUser } = useUser();
  const user = rawUser as Record<string, unknown> | undefined;

  // Priority: View As override > user preference > segment default
  const overrideDepth = getGovernanceDepthOverride();
  const storedDepth =
    typeof user?.governance_depth === 'string' ? user.governance_depth : undefined;
  const userDepth = storedDepth && isValidDepth(storedDepth) ? storedDepth : undefined;
  const defaultDepth = getDefaultDepthForSegment(segment);

  // Anonymous users default to informed — they see Compass Guide narratives and
  // enriched browse content. Personal intelligence is gated via PersonalTeaser.
  const depth = segment === 'anonymous' ? 'informed' : (overrideDepth ?? userDepth ?? defaultDepth);
  const level = getTunerLevel(depth);
  const isDefault = !overrideDepth && !userDepth;

  return {
    depth,
    level,
    order: level.order,
    isDefault,
    isAtLeast: (threshold: GovernanceDepth) => level.order >= getTunerLevel(threshold).order,
  };
}
