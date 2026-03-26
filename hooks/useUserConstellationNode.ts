'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSegment } from '@/components/providers/SegmentProvider';
import {
  computeSpherePosition,
  sphereToCartesian,
  GLOBE_RADIUS,
} from '@/lib/constellation/globe-layout';
import { getDominantDimension, alignmentsToArray } from '@/lib/drepIdentity';
import type { AlignmentScores } from '@/lib/drepIdentity';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import { getStoredSession } from '@/lib/supabaseAuth';

interface UserProfile {
  alignmentScores: AlignmentScores | null;
  personalityLabel: string | null;
  votesUsed: number;
  confidence: number;
}

function fetchProfile(): Promise<UserProfile | null> {
  const headers: Record<string, string> = {};
  const token = getStoredSession();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return fetch('/api/governance/my-profile', { headers })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

const NEUTRAL_ALIGNMENTS: AlignmentScores = {
  treasuryConservative: 50,
  treasuryGrowth: 50,
  decentralization: 50,
  security: 50,
  innovation: 50,
  transparency: 50,
};

/**
 * Computes the authenticated user's constellation node for placement on the globe.
 * Returns null for anonymous users or when profile data is unavailable.
 *
 * The user node is positioned using the same alignment → sphere mapping as DReps,
 * so the user appears among governance entities who share their alignment values.
 */
export function useUserConstellationNode(): {
  userNode: ConstellationNode3D | null;
  isLoading: boolean;
  hasAlignmentData: boolean;
  delegationBond: { drepNodeId: string; driftScore: number } | null;
  userAlignments: number[] | null;
} {
  const { segment, stakeAddress, delegatedDrep } = useSegment();
  const isAuthenticated = segment !== 'anonymous' && stakeAddress !== null;

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-constellation-profile', stakeAddress],
    queryFn: fetchProfile,
    staleTime: 5 * 60_000,
    enabled: isAuthenticated,
  });

  const userNode = useMemo(() => {
    if (!isAuthenticated) return null;

    // Cold-start: if profile hasn't loaded or has no alignment data, use neutral position
    const alignments = profile?.alignmentScores ?? NEUTRAL_ALIGNMENTS;
    const hasData = (profile?.votesUsed ?? 0) > 0 && profile?.alignmentScores !== null;
    const dominant = getDominantDimension(alignments);
    const alignmentArray = alignmentsToArray(alignments);

    // Use existing layout positioning — same as DReps
    const layoutInput = {
      id: `user-${stakeAddress ?? 'self'}`,
      fullId: stakeAddress ?? 'self',
      name: null,
      power: 0.5, // moderate presence
      score: profile?.confidence ?? 0,
      dominant,
      alignments: alignmentArray,
      nodeType: 'user' as const,
    };

    const [lon, lat] = computeSpherePosition(layoutInput);
    const position = sphereToCartesian(lat, lon, GLOBE_RADIUS);

    // User node must be unmissable — larger than any DRep (max 0.25)
    const scale = hasData ? 0.35 : 0.28;

    return {
      ...layoutInput,
      position,
      scale,
      isAnchor: false, // must be false — flyToNode skips anchor nodes
    } satisfies ConstellationNode3D;
  }, [isAuthenticated, profile, stakeAddress]);

  // Drift score for delegation bond visualization
  const { data: driftData } = useQuery({
    queryKey: ['constellation-drift', stakeAddress],
    queryFn: async () => {
      const res = await fetch('/api/governance/drift');
      if (!res.ok) return null;
      return res.json() as Promise<{ driftScore: number }>;
    },
    staleTime: 5 * 60_000,
    enabled: isAuthenticated && !!delegatedDrep,
  });

  const delegationBond = useMemo(() => {
    if (!delegatedDrep || !driftData) return null;
    // The DRep node ID in the constellation uses the short form
    const shortId = delegatedDrep.length > 20 ? delegatedDrep.slice(0, 20) : delegatedDrep;
    return {
      drepNodeId: shortId,
      driftScore: driftData.driftScore ?? 0,
    };
  }, [delegatedDrep, driftData]);

  const userAlignments = useMemo(() => {
    if (!profile?.alignmentScores) return null;
    return alignmentsToArray(profile.alignmentScores);
  }, [profile]);

  return {
    userNode,
    isLoading,
    hasAlignmentData: (profile?.votesUsed ?? 0) > 0,
    delegationBond,
    userAlignments,
  };
}
