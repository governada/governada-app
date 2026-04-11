'use client';

import { useGovernanceConstellation } from '@/hooks/queries';

export function useConstellationProposals() {
  const { data, isLoading } = useGovernanceConstellation();

  return {
    proposalNodes: data?.proposalNodes ?? [],
    isLoading,
  };
}
