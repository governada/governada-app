import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { WorkspaceDelegatorsPage } from '@/components/hub/WorkspaceDelegatorsPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Delegators — Governada',
  description: 'Your delegator summary and recent changes.',
};

export default function WorkspaceDelegators() {
  return (
    <>
      <PageViewTracker event="workspace_delegators_viewed" />
      <WorkspaceDelegatorsPage />
    </>
  );
}
