'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useSegment } from '@/components/providers/SegmentProvider';
import { FeatureGate, useFeatureFlag } from '@/components/FeatureGate';
import { useDrafts, useCreateDraft, useTeamDrafts } from '@/hooks/useDrafts';
import { useAuthorTableItems } from '@/hooks/useAuthorTableItems';
import { useRegisterDraftListCommands } from '@/hooks/useRegisterDraftListCommands';
import { commandRegistry } from '@/lib/workspace/commands';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { PortfolioView } from './PortfolioView';
import { PortfolioSearch } from '@/components/workspace/shared/PortfolioSearch';
import { PortfolioStats } from '@/components/workspace/shared/PortfolioStats';
import { TriageSummary } from '@/components/workspace/shared/TriageSummary';
import type { TriageInsight } from '@/components/workspace/shared/TriageSummary';
import { TeamProposalsSection } from './TeamProposalsSection';
import { TypeSelectorDialog } from './TypeSelectorDialog';
import { AmendmentEntryDialog } from './AmendmentEntryDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { ProposalType, DraftStatus } from '@/lib/workspace/types';

const AuthorDecisionTable = dynamic(
  () => import('./AuthorDecisionTable').then((m) => ({ default: m.AuthorDecisionTable })),
  { ssr: false },
);

const AUTHOR_REVIEW_STATUSES: DraftStatus[] = [
  'community_review',
  'response_revision',
  'final_comment',
];

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000));
}

function AuthorWorkspaceInner() {
  const router = useRouter();
  const { stakeAddress } = useSegment();
  const [showArchived, setShowArchived] = useState(false);
  const {
    data,
    isLoading,
    error: draftsError,
  } = useDrafts(stakeAddress, {
    includeArchived: showArchived,
  });
  const { data: teamData, isLoading: teamLoading } = useTeamDrafts(stakeAddress);
  const createDraft = useCreateDraft();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [amendmentDialogOpen, setAmendmentDialogOpen] = useState(false);
  const [pendingAmendmentType, setPendingAmendmentType] = useState<'direct' | 'intent' | null>(
    null,
  );

  const constitutionEditorFlag = useFeatureFlag('author_constitution_editor');
  const decisionTableFlag = useFeatureFlag('workspace_decision_table');
  const authorTableItems = useAuthorTableItems(data);
  const authorFilter = useWorkspaceStore((s) => s.authorFilter);
  const setAuthorFilter = useWorkspaceStore((s) => s.setAuthorFilter);
  const authorViewMode = useWorkspaceStore((s) => s.authorViewMode);
  const setAuthorViewMode = useWorkspaceStore((s) => s.setAuthorViewMode);

  // Register J/K keyboard navigation + quick action shortcuts for the drafts list
  useRegisterDraftListCommands();
  const authorStats = useMemo(() => {
    const allDrafts = data?.drafts ?? [];
    const draftCount = allDrafts.filter((d) => d.status === 'draft').length;
    const inReviewCount = allDrafts.filter((d) => AUTHOR_REVIEW_STATUSES.includes(d.status)).length;
    const onChainCount = allDrafts.filter((d) => d.status === 'submitted').length;
    return [
      { label: 'total', value: allDrafts.length },
      { label: 'drafts', value: draftCount },
      {
        label: 'in review',
        value: inReviewCount,
        emphasis: inReviewCount > 0,
        color: inReviewCount > 0 ? 'text-amber-400' : undefined,
      },
      {
        label: 'on-chain',
        value: onChainCount,
        emphasis: onChainCount > 0,
        color: onChainCount > 0 ? 'text-[var(--compass-teal)]' : undefined,
      },
    ];
  }, [data?.drafts]);

  // Generate triage insights from data
  const triageInsights = useMemo((): TriageInsight[] => {
    const allDrafts = data?.drafts ?? [];
    const insights: TriageInsight[] = [];

    // Drafts in review for a long time
    const longReviewDrafts = allDrafts.filter((d) => {
      if (!AUTHOR_REVIEW_STATUSES.includes(d.status) || !d.communityReviewStartedAt) return false;
      return daysSince(d.communityReviewStartedAt) >= 7;
    });
    if (longReviewDrafts.length > 0) {
      const d = longReviewDrafts[0];
      const days = daysSince(d.communityReviewStartedAt);
      insights.push({
        text: `"${d.title || 'Untitled'}" has been in review for ${days} days — check for new feedback.`,
        priority: 8,
      });
    }

    // Drafts with failed constitutional check
    const failedCheck = allDrafts.find(
      (d) => d.lastConstitutionalCheck?.score === 'fail' && d.status !== 'archived',
    );
    if (failedCheck) {
      insights.push({
        text: `"${failedCheck.title || 'Untitled'}" has a failing constitutional check.`,
        priority: 9,
      });
    }

    // Incomplete drafts nudge
    const incompleteDrafts = allDrafts.filter((d) => {
      if (d.status !== 'draft') return false;
      const fields = [d.title, d.abstract, d.motivation, d.rationale];
      return fields.filter((f) => f && f.trim().length > 0).length < 4;
    });
    if (incompleteDrafts.length > 0 && insights.length === 0) {
      insights.push({
        text: `${incompleteDrafts.length} draft${incompleteDrafts.length > 1 ? 's' : ''} still need${incompleteDrafts.length === 1 ? 's' : ''} sections completed.`,
        priority: 3,
      });
    }

    return insights;
  }, [data?.drafts]);

  // Register `c` shortcut to open type selector (like Linear's `C` for new issue)
  const openSelector = useCallback(() => setSelectorOpen(true), []);
  useEffect(() => {
    const unregister = commandRegistry.register({
      id: 'author.new-proposal',
      label: 'New Proposal',
      shortcut: 'c',
      section: 'actions',
      execute: openSelector,
    });
    return unregister;
  }, [openSelector]);

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
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Proposal Author</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Draft, review, and submit governance proposals with AI-assisted constitutional checks.
          </p>
        </div>
        <Button onClick={() => setSelectorOpen(true)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          New Proposal
        </Button>
      </div>

      {createError && <p className="text-sm text-destructive">{createError}</p>}

      {draftsError && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">Failed to load your proposals</p>
            <p className="text-xs text-muted-foreground/60">
              Check your connection and try refreshing the page.
            </p>
          </div>
        </div>
      )}

      {decisionTableFlag === false && (
        <PortfolioSearch
          filter={authorFilter}
          onFilterChange={setAuthorFilter}
          viewMode={authorViewMode}
          onViewModeChange={setAuthorViewMode}
          showArchiveToggle
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
          placeholder="Search drafts..."
        />
      )}

      <PortfolioStats stats={authorStats} />

      <TriageSummary insights={triageInsights} />

      {decisionTableFlag !== false ? (
        <AuthorDecisionTable items={authorTableItems} isLoading={isLoading} />
      ) : (
        <PortfolioView
          drafts={data?.drafts ?? []}
          isLoading={isLoading}
          showArchived={showArchived}
        />
      )}

      <TeamProposalsSection drafts={teamData?.drafts ?? []} isLoading={teamLoading} />

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
