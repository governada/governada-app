'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDraft } from '@/hooks/useDrafts';
import { useTeam } from '@/hooks/useTeam';
import { DraftForm } from './DraftForm';
import { DraftActions } from './DraftActions';
import { LifecycleStatus } from './LifecycleStatus';
import { ReviewsList } from './ReviewsList';
import { ReviewRubric } from './ReviewRubric';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import { PROPOSAL_TYPE_LABELS } from '@/lib/workspace/types';
import type { TeamRole } from '@/lib/workspace/types';
import Link from 'next/link';

interface DraftEditorProps {
  /** The stake address of the current viewer (for owner checks). */
  viewerStakeAddress?: string | null;
}

export function DraftEditor({ viewerStakeAddress }: DraftEditorProps = {}) {
  const params = useParams();
  const router = useRouter();
  const draftId = typeof params.draftId === 'string' ? params.draftId : null;
  const { data, isLoading, error } = useDraft(draftId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-7 w-64" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
        <div className="flex gap-6">
          <Skeleton className="h-[600px] flex-1 rounded-xl" />
          <Skeleton className="h-[400px] w-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data?.draft) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-3">Draft Not Found</h1>
        <p className="text-muted-foreground mb-4">
          This draft may have been deleted or you don&apos;t have access to it.
        </p>
        <Button variant="outline" onClick={() => router.push('/workspace/author')}>
          Back to Author
        </Button>
      </div>
    );
  }

  const { draft, versions } = data;

  // Fetch team data for this draft
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: teamData } = useTeam(draftId);
  const userRole: TeamRole | null = (() => {
    if (!viewerStakeAddress || !teamData?.members) return null;
    const member = teamData.members.find((m) => m.stakeAddress === viewerStakeAddress);
    return member?.role ?? null;
  })();

  const isOwner = viewerStakeAddress === draft.ownerStakeAddress;
  const isTeamMember = userRole !== null;
  const canEdit = isOwner || userRole === 'lead' || userRole === 'editor';
  const stageReadOnly = draft.status === 'final_comment' || draft.status === 'submitted';
  const isReadOnly = stageReadOnly || (isTeamMember && !canEdit);
  const showReviewForm =
    draft.status === 'community_review' && !isOwner && !isTeamMember && !!viewerStakeAddress;
  const showReviews =
    draft.status === 'community_review' ||
    draft.status === 'response_revision' ||
    draft.status === 'final_comment' ||
    draft.status === 'submitted';

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/workspace/author">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-lg font-bold truncate">{draft.title || 'Untitled Draft'}</h1>
          <Badge variant="outline" className="text-xs shrink-0">
            {PROPOSAL_TYPE_LABELS[draft.proposalType] ?? draft.proposalType}
          </Badge>
        </div>
      </div>

      {/* Lifecycle status bar */}
      <LifecycleStatus
        status={draft.status}
        stageEnteredAt={draft.stageEnteredAt}
        communityReviewStartedAt={draft.communityReviewStartedAt}
        fcpStartedAt={draft.fcpStartedAt}
      />

      {/* Two-column layout on desktop, stacked on mobile */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0 space-y-4">
          {/* Show review form for non-owners during community review */}
          {showReviewForm && draftId && viewerStakeAddress && (
            <ReviewRubric
              draftId={draftId}
              reviewerStakeAddress={viewerStakeAddress}
              onSuccess={() => {}}
            />
          )}

          {/* Show draft form (read-only in later stages or for viewers) */}
          {(!showReviewForm || isOwner || isTeamMember) && (
            <DraftForm draft={draft} readOnly={isReadOnly} />
          )}

          {/* Reviews section */}
          {showReviews && draftId && <ReviewsList draftId={draftId} isOwner={isOwner} />}
        </div>
        <div className="w-full lg:w-80 shrink-0">
          <DraftActions
            draft={draft}
            versions={versions}
            viewerStakeAddress={viewerStakeAddress}
            userRole={userRole}
          />
        </div>
      </div>
    </div>
  );
}
