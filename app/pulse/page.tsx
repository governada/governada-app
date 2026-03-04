import { Metadata } from 'next';
import { PulseHub } from '@/components/PulseHub';
import { PageViewTracker } from '@/components/PageViewTracker';
import { getFeatureFlag } from '@/lib/featureFlags';
import { CivicaPulseOverview } from '@/components/civica/pulse/CivicaPulseOverview';

export const metadata: Metadata = {
  title: 'Civica — Pulse',
  description:
    "Real-time state of Cardano's on-chain governance — active proposals, treasury activity, DRep participation, and governance health.",
  openGraph: {
    title: 'Civica — Governance Pulse',
    description: "Real-time health of Cardano's on-chain governance.",
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civica — Governance Pulse',
    description: "Track the real-time state of Cardano's governance.",
  },
};

export const dynamic = 'force-dynamic';

export default async function PulsePage() {
  const civicaEnabled = await getFeatureFlag('civica_frontend');

  if (civicaEnabled) {
    return (
      <>
        <PageViewTracker event="pulse_page_viewed" />
        <div className="container mx-auto px-4 sm:px-6 py-6">
          <CivicaPulseOverview />
        </div>
      </>
    );
  }

  return (
    <>
      <PageViewTracker event="pulse_page_viewed" />
      <PulseHub />
    </>
  );
}
