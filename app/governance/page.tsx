export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { GovernanceRedirect } from './GovernanceRedirect';

export const metadata: Metadata = {
  title: 'Governance — Governada',
  description:
    'Explore Cardano governance. Browse proposals, representatives, stake pools, and the governance health index.',
  openGraph: {
    title: 'Governance — Governada',
    description: 'Everything happening in Cardano governance, in one place.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Governance — Governada',
    description: 'Explore Cardano governance proposals, DReps, and health metrics.',
  },
};

/**
 * /governance — persona-aware redirect to the most relevant sub-page.
 *
 * | Persona               | Destination                   |
 * | --------------------- | ----------------------------- |
 * | Anonymous             | /governance/proposals          |
 * | Citizen (undelegated) | /governance/representatives    |
 * | Citizen (delegated)   | /governance/proposals          |
 * | DRep                  | /governance/proposals          |
 * | SPO                   | /governance/pools              |
 * | CC                    | /governance/proposals          |
 */
export default function GovernancePage() {
  return <GovernanceRedirect />;
}
