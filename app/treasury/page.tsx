import type { Metadata } from 'next';
import { TreasuryDashboard } from '@/components/TreasuryDashboard';
import { GovernanceSubNav } from '@/components/GovernanceSubNav';

export const metadata: Metadata = {
  title: 'Treasury Intelligence — DRepScore',
  description:
    'Real-time Cardano treasury health, runway projections, spending accountability, and What-If simulation.',
  openGraph: {
    title: 'Cardano Treasury Intelligence — DRepScore',
    description:
      'Track Cardano treasury health, spending trends, and runway projections. The first treasury accountability dashboard in crypto.',
  },
};

export default function TreasuryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <GovernanceSubNav />
      <TreasuryDashboard />
    </div>
  );
}
