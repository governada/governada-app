import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { WorkspacePerformancePage } from '@/components/hub/WorkspacePerformancePage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Performance — Governada',
  description: 'Your DRep score breakdown and competitive position.',
};

export default function WorkspacePerformance() {
  return (
    <>
      <PageViewTracker event="workspace_performance_viewed" />
      <WorkspacePerformancePage />
    </>
  );
}
