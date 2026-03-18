'use client';

import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Copy, Archive, Trash2, Download } from 'lucide-react';
import { commandRegistry } from '@/lib/workspace/commands';
import { useFocusStore } from '@/lib/workspace/focus';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useDrafts } from '@/hooks/useDrafts';
import {
  useArchiveDraft,
  useDuplicateDraft,
  useDeleteDraft,
  useExportDraft,
} from '@/hooks/useDraftActions';
import type { ProposalDraft } from '@/lib/workspace/types';

const REVIEW_STATUSES = ['community_review', 'response_revision', 'final_comment'] as const;

/**
 * Registers J/K navigation commands and quick action shortcuts (d/a/x/e)
 * for the draft list on the Author dashboard.
 *
 * These commands only activate when the 'drafts-list' is the active focus list
 * (set by `useFocusableList` in PortfolioView).
 *
 * Follows the same pattern as useRegisterReviewCommands.
 */
export function useRegisterDraftListCommands() {
  const { stakeAddress } = useSegment();
  const { data } = useDrafts(stakeAddress);
  const draftsRef = useRef<ProposalDraft[]>([]);

  const archiveMutation = useArchiveDraft(stakeAddress);
  const duplicateMutation = useDuplicateDraft(stakeAddress);
  const deleteMutation = useDeleteDraft(stakeAddress);
  const exportMutation = useExportDraft();

  // Keep a ref to the current drafts list for command handlers
  useEffect(() => {
    draftsRef.current = data?.drafts ?? [];
  }, [data?.drafts]);

  /** Get the currently focused draft based on the flat list order */
  const getFocusedDraftRef = useRef(() => {
    const { activeListId, activeIndex } = useFocusStore.getState();
    if (activeListId !== 'drafts-list') return undefined;

    // Reconstruct the flat list order (same as PortfolioView grouping)
    const all = draftsRef.current;
    const draftItems = all.filter((d) => d.status === 'draft');
    const inReview = all.filter((d) => (REVIEW_STATUSES as readonly string[]).includes(d.status));
    const onChain = all.filter((d) => d.status === 'submitted');
    const archived = all.filter((d) => d.status === 'archived');
    const flatList = [...draftItems, ...inReview, ...onChain, ...archived];

    return flatList[activeIndex];
  });

  // Store stable mutation refs so the effect closure doesn't go stale
  const archiveRef = useRef(archiveMutation);
  const duplicateRef = useRef(duplicateMutation);
  const deleteRef = useRef(deleteMutation);
  const exportRef = useRef(exportMutation);

  useEffect(() => {
    archiveRef.current = archiveMutation;
  }, [archiveMutation]);
  useEffect(() => {
    duplicateRef.current = duplicateMutation;
  }, [duplicateMutation]);
  useEffect(() => {
    deleteRef.current = deleteMutation;
  }, [deleteMutation]);
  useEffect(() => {
    exportRef.current = exportMutation;
  }, [exportMutation]);

  useEffect(() => {
    const getFocusedDraft = getFocusedDraftRef.current;
    const unregisters: Array<() => void> = [];

    // J/K navigation
    unregisters.push(
      commandRegistry.register({
        id: 'author.list-down',
        label: 'Next Draft',
        shortcut: 'j',
        icon: ChevronDown,
        section: 'actions',
        when: () => useFocusStore.getState().activeListId === 'drafts-list',
        execute: () => useFocusStore.getState().moveDown(),
      }),
    );

    unregisters.push(
      commandRegistry.register({
        id: 'author.list-up',
        label: 'Previous Draft',
        shortcut: 'k',
        icon: ChevronUp,
        section: 'actions',
        when: () => useFocusStore.getState().activeListId === 'drafts-list',
        execute: () => useFocusStore.getState().moveUp(),
      }),
    );

    // d -- Duplicate focused draft
    unregisters.push(
      commandRegistry.register({
        id: 'author.duplicate-draft',
        label: 'Duplicate Draft',
        shortcut: 'd',
        icon: Copy,
        section: 'actions',
        when: () => !!getFocusedDraft(),
        execute: () => {
          const draft = getFocusedDraft();
          if (draft) duplicateRef.current.mutate({ draftId: draft.id });
        },
      }),
    );

    // a -- Archive focused draft
    unregisters.push(
      commandRegistry.register({
        id: 'author.archive-draft',
        label: 'Archive Draft',
        shortcut: 'a',
        icon: Archive,
        section: 'actions',
        when: () => {
          const draft = getFocusedDraft();
          if (!draft) return false;
          return (
            draft.status === 'draft' ||
            (REVIEW_STATUSES as readonly string[]).includes(draft.status)
          );
        },
        execute: () => {
          const draft = getFocusedDraft();
          if (draft) archiveRef.current.mutate({ draftId: draft.id });
        },
      }),
    );

    // x -- Delete focused draft (only when status === 'draft')
    unregisters.push(
      commandRegistry.register({
        id: 'author.delete-draft',
        label: 'Delete Draft',
        shortcut: 'x',
        icon: Trash2,
        section: 'actions',
        when: () => {
          const draft = getFocusedDraft();
          return !!draft && draft.status === 'draft';
        },
        execute: () => {
          const draft = getFocusedDraft();
          if (draft) deleteRef.current.mutate({ draftId: draft.id });
        },
      }),
    );

    // e -- Export focused draft (as markdown)
    unregisters.push(
      commandRegistry.register({
        id: 'author.export-draft',
        label: 'Export Draft',
        shortcut: 'e',
        icon: Download,
        section: 'actions',
        when: () => !!getFocusedDraft(),
        execute: () => {
          const draft = getFocusedDraft();
          if (draft) exportRef.current.mutate({ draftId: draft.id, format: 'markdown' });
        },
      }),
    );

    return () => {
      for (const unregister of unregisters) {
        unregister();
      }
    };
  }, []);
}
