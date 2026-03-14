export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { MyGovClient } from '@/components/governada/MyGovClient';

export const metadata: Metadata = {
  title: 'Governada — My Gov',
  description:
    'Your civic command center. Track your delegation, governance activity, and take action.',
  openGraph: {
    title: 'Governada — My Gov',
    description:
      'Your civic command center. Track your delegation, governance activity, and take action.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Governada — My Gov',
    description: 'Your civic command center on Cardano.',
  },
};

export default function MyGovPage() {
  return <MyGovClient />;
}
