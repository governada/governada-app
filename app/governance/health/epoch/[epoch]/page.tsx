export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Epoch Report',
  description: 'Detailed governance report for a specific epoch.',
};

/**
 * /governance/health/epoch/[epoch] — placeholder.
 * Will be populated with content migrated from /pulse/report/[epoch].
 */
export default function EpochReportPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Epoch Report</h1>
      <p className="text-muted-foreground">Epoch-specific governance report will appear here.</p>
    </div>
  );
}
