import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { DelegationPage } from '@/components/hub/DelegationPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your Governance Coverage — Governada',
  description:
    'See who represents your ADA in Cardano governance. Review your DRep and stake pool delegation.',
};

export default function Delegation() {
  return (
    <>
      <PageViewTracker event="delegation_viewed" />
      <DelegationPage />
    </>
  );
}
