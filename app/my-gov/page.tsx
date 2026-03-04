import type { Metadata } from 'next';
import { MyGovClient } from '@/components/civica/MyGovClient';

export const metadata: Metadata = {
  title: 'Civica — My Gov',
  description:
    'Your civic command center. Track your delegation, governance activity, and take action.',
  openGraph: {
    title: 'Civica — My Gov',
    description:
      'Your civic command center. Track your delegation, governance activity, and take action.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Civica — My Gov',
    description: 'Your civic command center on Cardano.',
  },
};

export default function MyGovPage() {
  return <MyGovClient />;
}
