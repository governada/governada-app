import { Metadata } from 'next';
import { PulseHub } from '@/components/PulseHub';
import { PageViewTracker } from '@/components/PageViewTracker';

export const metadata: Metadata = {
  title: 'Governance Pulse | DRepScore',
  description: 'Real-time governance intelligence for Cardano',
};

export const dynamic = 'force-dynamic';

export default function PulsePage() {
  return (
    <>
      <PageViewTracker event="pulse_page_viewed" />
      <PulseHub />
    </>
  );
}
