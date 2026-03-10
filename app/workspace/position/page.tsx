import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { WorkspacePositionPage } from '@/components/hub/WorkspacePositionPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Competitive Position — Governada',
  description: 'See where your pool ranks in governance participation.',
};

export default function WorkspacePosition() {
  return (
    <>
      <PageViewTracker event="workspace_position_viewed" />
      <WorkspacePositionPage />
    </>
  );
}
