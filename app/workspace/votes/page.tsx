import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { WorkspaceVotesPage } from '@/components/hub/WorkspaceVotesPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Voting Record — Governada',
  description: 'Your complete voting record with rationale status.',
};

export default function WorkspaceVotes() {
  return (
    <>
      <PageViewTracker event="workspace_votes_viewed" />
      <WorkspaceVotesPage />
    </>
  );
}
