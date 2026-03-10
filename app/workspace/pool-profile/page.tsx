import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { WorkspacePoolProfilePage } from '@/components/hub/WorkspacePoolProfilePage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pool Profile — Governada',
  description: 'Manage your pool governance identity.',
};

export default function WorkspacePoolProfile() {
  return (
    <>
      <PageViewTracker event="workspace_pool_profile_viewed" />
      <WorkspacePoolProfilePage />
    </>
  );
}
