import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { WorkspacePage } from '@/components/hub/WorkspacePage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Workspace — Governada',
  description: 'Your governance workspace. Review pending proposals and take action.',
};

export default function Workspace() {
  return (
    <>
      <PageViewTracker event="workspace_viewed" />
      <WorkspacePage />
    </>
  );
}
