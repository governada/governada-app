import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { WorkspaceRationalesPage } from '@/components/hub/WorkspaceRationalesPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Rationales — Governada',
  description: 'Your published governance rationales and their reception.',
};

export default function WorkspaceRationales() {
  return (
    <>
      <PageViewTracker event="workspace_rationales_viewed" />
      <WorkspaceRationalesPage />
    </>
  );
}
