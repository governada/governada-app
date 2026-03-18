'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSegment } from '@/components/providers/SegmentProvider';
import { FeatureGate, useFeatureFlag } from '@/components/FeatureGate';
import { useDrafts, useCreateDraft } from '@/hooks/useDrafts';
import { useRegisterDraftListCommands } from '@/hooks/useRegisterDraftListCommands';
import { DraftsList } from './DraftsList';
import { TypeSelectorDialog } from './TypeSelectorDialog';
import { AmendmentEntryDialog } from './AmendmentEntryDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { ProposalType } from '@/lib/workspace/types';

function AuthorWorkspaceInner() {
  const router = useRouter();
  const { stakeAddress } = useSegment();
  const { data, isLoading } = useDrafts(stakeAddress);
  const createDraft = useCreateDraft();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [amendmentDialogOpen, setAmendmentDialogOpen] = useState(false);
  const [pendingAmendmentType, setPendingAmendmentType] = useState<'direct' | 'intent' | null>(
    null,
  );

  const constitutionEditorFlag = useFeatureFlag('author_constitution_editor');

  // Register J/K keyboard navigation for the drafts list
  useRegisterDraftListCommands();

  const createAmendmentDraft = async (mode: 'direct' | 'intent') => {
    if (!stakeAddress) return;
    setCreateError(null);
    setPendingAmendmentType(mode);
    try {
      const result = await createDraft.mutateAsync({
        stakeAddress,
        proposalType: 'NewConstitution',
      });
      setAmendmentDialogOpen(false);
      setSelectorOpen(false);
      setPendingAmendmentType(null);
      const suffix = mode === 'intent' ? '?mode=intent' : '';
      router.push(`/workspace/amendment/${result.draft.id}${suffix}`);
    } catch {
      setCreateError('Failed to create draft. Please try again.');
      setPendingAmendmentType(null);
    }
  };

  const handleCreateDraft = async (proposalType: ProposalType) => {
    if (!stakeAddress) return;

    // Intercept NewConstitution when the amendment editor flag is enabled.
    // constitutionEditorFlag is null while loading, true/false once resolved.
    // If null (still loading), treat as enabled to avoid racing past to the old flow.
    if (proposalType === 'NewConstitution' && constitutionEditorFlag !== false) {
      setSelectorOpen(false);
      setAmendmentDialogOpen(true);
      return;
    }

    setCreateError(null);
    try {
      const result = await createDraft.mutateAsync({ stakeAddress, proposalType });
      setSelectorOpen(false);
      router.push(`/workspace/author/${result.draft.id}`);
    } catch {
      setCreateError('Failed to create draft. Please try again.');
    }
  };

  if (!stakeAddress) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-3">Proposal Author</h1>
        <p className="text-muted-foreground">Connect your wallet to start drafting proposals.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Proposal Author</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Draft governance proposals, run constitutional checks, and preview CIP-108 metadata.
          </p>
        </div>
        <Button onClick={() => setSelectorOpen(true)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          New Proposal
        </Button>
      </div>

      {createError && <p className="text-sm text-destructive">{createError}</p>}

      <DraftsList drafts={data?.drafts ?? []} isLoading={isLoading} />

      <TypeSelectorDialog
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        onSelect={handleCreateDraft}
        isPending={createDraft.isPending}
      />

      <AmendmentEntryDialog
        open={amendmentDialogOpen}
        onOpenChange={setAmendmentDialogOpen}
        onStartDirect={() => createAmendmentDraft('direct')}
        onStartIntent={() => createAmendmentDraft('intent')}
        isPending={pendingAmendmentType !== null}
      />
    </div>
  );
}

export function AuthorWorkspace() {
  return (
    <FeatureGate
      flag="proposal_workspace"
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-3">Proposal Author</h1>
          <p className="text-muted-foreground">
            The proposal workspace is not yet available. Check back soon.
          </p>
        </div>
      }
    >
      <AuthorWorkspaceInner />
    </FeatureGate>
  );
}
