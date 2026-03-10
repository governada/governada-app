export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { MyGovClient } from '@/components/civica/MyGovClient';

export const metadata: Metadata = {
  title: 'Governada — Workspace',
  description:
    'Your governance workspace. Action queue for DReps, governance score dashboard for SPOs.',
  openGraph: {
    title: 'Governada — Workspace',
    description: 'Your governance workspace on Cardano.',
    type: 'website',
  },
};

export default function WorkspacePage() {
  return <MyGovClient />;
}
