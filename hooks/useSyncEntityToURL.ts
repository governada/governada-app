'use client';

import { useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/workspace/store';

/**
 * Syncs entity IDs between URL params and the workspace Zustand store.
 *
 * - Reads `draftId` from route params (e.g. `/workspace/editor/[draftId]`)
 *   and writes it to `store.currentDraftId`
 * - Reads `proposal` from searchParams (e.g. `?proposal=tx_hash:index`)
 *   and writes it to `store.currentProposalId`
 * - Clears entity IDs when the component unmounts (navigating away)
 *
 * This is a one-way URL → store sync. The URL is the source of truth for
 * entity selection — the store makes it accessible to sibling components
 * without prop drilling.
 */
export function useSyncEntityToURL() {
  const params = useParams();
  const searchParams = useSearchParams();
  const setCurrentDraft = useWorkspaceStore((s) => s.setCurrentDraft);
  const setCurrentProposal = useWorkspaceStore((s) => s.setCurrentProposal);

  // Sync draftId from route params
  const draftId = typeof params.draftId === 'string' ? params.draftId : null;

  useEffect(() => {
    setCurrentDraft(draftId);
    return () => setCurrentDraft(null);
  }, [draftId, setCurrentDraft]);

  // Sync proposalId from searchParams
  const proposalId = searchParams.get('proposal');

  useEffect(() => {
    setCurrentProposal(proposalId);
    return () => setCurrentProposal(null);
  }, [proposalId, setCurrentProposal]);

  return { draftId, proposalId };
}
