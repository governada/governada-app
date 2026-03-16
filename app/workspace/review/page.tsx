import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { FeatureGate } from '@/components/FeatureGate';
import { ReviewWorkspace } from '@/components/workspace/review/ReviewWorkspace';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Review Proposals — Governada',
  description: 'Review active governance proposals, vote, and write rationales.',
};

interface ReviewPageProps {
  searchParams: Promise<{ proposal?: string }>;
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = await searchParams;
  return (
    <>
      <PageViewTracker event="review_workspace_viewed" />
      <FeatureGate flag="proposal_workspace">
        <ReviewWorkspace initialProposalKey={params.proposal} />
      </FeatureGate>
    </>
  );
}
