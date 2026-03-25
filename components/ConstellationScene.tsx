'use client';

import { forwardRef } from 'react';
import dynamic from 'next/dynamic';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
import type { ConstellationNode3D } from '@/lib/constellation/types';

const GlobeConstellation = dynamic(
  () =>
    import('@/components/GlobeConstellation').then((m) => ({
      default: m.GlobeConstellation,
    })),
  { ssr: false },
);

interface ConstellationSceneProps {
  interactive?: boolean;
  onReady?: () => void;
  onContracted?: () => void;
  onNodeSelect?: (node: ConstellationNode3D) => void;
  onNodeHover?: (node: ConstellationNode3D | null) => void;
  className?: string;
  /** 0-100 governance health index — drives atmosphere color */
  healthScore?: number;
  /** 0-100 governance urgency — drives heartbeat pulse frequency */
  urgency?: number;
  /** Enable breathing animation (gentle scale pulse) */
  breathing?: boolean;
}

/**
 * Constellation wrapper. Always renders the globe variant.
 */
export const ConstellationScene = forwardRef<ConstellationRef, ConstellationSceneProps>(
  function ConstellationScene(props, ref) {
    return <GlobeConstellation ref={ref} {...props} />;
  },
);
