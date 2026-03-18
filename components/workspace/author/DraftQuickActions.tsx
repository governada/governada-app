'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  MoreHorizontal,
  Pencil,
  Copy,
  Archive,
  ArchiveRestore,
  Trash2,
  Download,
  ArrowRightLeft,
  GitFork,
} from 'lucide-react';
import {
  useArchiveDraft,
  useUnarchiveDraft,
  useDuplicateDraft,
  useDeleteDraft,
  useExportDraft,
} from '@/hooks/useDraftActions';
import type { ProposalDraft, DraftStatus } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DraftQuickActionsProps {
  draft: ProposalDraft;
  router: AppRouterInstance;
}

// ---------------------------------------------------------------------------
// Action availability by status
// ---------------------------------------------------------------------------

const REVIEW_STATUSES: DraftStatus[] = ['community_review', 'response_revision', 'final_comment'];

function canEdit(status: DraftStatus): boolean {
  return status === 'draft' || REVIEW_STATUSES.includes(status);
}

function canArchive(status: DraftStatus): boolean {
  return status === 'draft' || REVIEW_STATUSES.includes(status);
}

function canDelete(status: DraftStatus): boolean {
  return status === 'draft';
}

function canUnarchive(status: DraftStatus): boolean {
  return status === 'archived';
}

function canTransfer(status: DraftStatus): boolean {
  return status === 'draft' || REVIEW_STATUSES.includes(status);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DraftQuickActions({ draft, router }: DraftQuickActionsProps) {
  const [open, setOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const archiveMutation = useArchiveDraft(draft.ownerStakeAddress);
  const unarchiveMutation = useUnarchiveDraft(draft.ownerStakeAddress);
  const duplicateMutation = useDuplicateDraft(draft.ownerStakeAddress);
  const deleteMutation = useDeleteDraft(draft.ownerStakeAddress);
  const exportDraft = useExportDraft();

  // Reset delete confirm when menu closes
  useEffect(() => {
    if (!open) {
      setDeleteConfirm(false);
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
        deleteTimerRef.current = null;
      }
    }
  }, [open]);

  const handleEdit = useCallback(() => {
    const path =
      draft.proposalType === 'NewConstitution'
        ? `/workspace/amendment/${draft.id}`
        : `/workspace/author/${draft.id}`;
    router.push(path);
    setOpen(false);
  }, [draft.id, draft.proposalType, router]);

  const handleDuplicate = useCallback(() => {
    duplicateMutation.mutate({ draftId: draft.id });
    setOpen(false);
  }, [draft.id, duplicateMutation]);

  const handleArchive = useCallback(() => {
    archiveMutation.mutate({ draftId: draft.id });
    setOpen(false);
  }, [draft.id, archiveMutation]);

  const handleUnarchive = useCallback(() => {
    unarchiveMutation.mutate({ draftId: draft.id });
    setOpen(false);
  }, [draft.id, unarchiveMutation]);

  const handleDelete = useCallback(() => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      // Reset after 3 seconds
      deleteTimerRef.current = setTimeout(() => {
        setDeleteConfirm(false);
        deleteTimerRef.current = null;
      }, 3000);
      return;
    }
    // Second click — execute
    deleteMutation.mutate({ draftId: draft.id });
    setDeleteConfirm(false);
    setOpen(false);
  }, [deleteConfirm, draft.id, deleteMutation]);

  const handleExport = useCallback(
    (format: 'markdown' | 'cip108') => {
      exportDraft.mutate({ draftId: draft.id, format });
      setOpen(false);
    },
    [draft.id, exportDraft],
  );

  const handleTransfer = useCallback(() => {
    // TODO: Transfer ownership — open dialog when API endpoint is ready
    setOpen(false);
  }, []);

  const isSubmitted = draft.status === 'submitted';

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          aria-label="Draft actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Edit */}
        {canEdit(draft.status) && (
          <DropdownMenuItem onSelect={handleEdit}>
            <Pencil className="h-4 w-4" />
            Edit
            <DropdownMenuShortcut>Enter</DropdownMenuShortcut>
          </DropdownMenuItem>
        )}

        {/* Duplicate / Fork & Revise */}
        <DropdownMenuItem onSelect={handleDuplicate}>
          {isSubmitted ? (
            <>
              <GitFork className="h-4 w-4" />
              Fork &amp; Revise
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Duplicate
            </>
          )}
          <DropdownMenuShortcut>d</DropdownMenuShortcut>
        </DropdownMenuItem>

        {/* Archive */}
        {canArchive(draft.status) && (
          <DropdownMenuItem onSelect={handleArchive}>
            <Archive className="h-4 w-4" />
            Archive
            <DropdownMenuShortcut>a</DropdownMenuShortcut>
          </DropdownMenuItem>
        )}

        {/* Unarchive */}
        {canUnarchive(draft.status) && (
          <DropdownMenuItem onSelect={handleUnarchive}>
            <ArchiveRestore className="h-4 w-4" />
            Unarchive
          </DropdownMenuItem>
        )}

        {/* Export sub-menu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Download className="h-4 w-4" />
            Export
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onSelect={() => handleExport('markdown')}>
              Markdown
              <DropdownMenuShortcut>e</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleExport('cip108')}>
              CIP-108 JSON
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Transfer */}
        {canTransfer(draft.status) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleTransfer}>
              <ArrowRightLeft className="h-4 w-4" />
              Transfer Ownership
            </DropdownMenuItem>
          </>
        )}

        {/* Delete (draft status only) */}
        {canDelete(draft.status) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                // Prevent menu from closing on first click
                if (!deleteConfirm) {
                  e.preventDefault();
                }
                handleDelete();
              }}
            >
              <Trash2 className="h-4 w-4" />
              {deleteConfirm ? 'Click again to delete' : 'Delete'}
              {!deleteConfirm && <DropdownMenuShortcut>x</DropdownMenuShortcut>}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
