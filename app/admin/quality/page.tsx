export const dynamic = 'force-dynamic';

import { Card, CardContent } from '@/components/ui/card';
import { Database } from 'lucide-react';

export default function DataQualityPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data Quality</h1>
        <p className="text-sm text-muted-foreground">
          Snapshot completeness, schema validation, and data freshness
        </p>
      </div>
      <Card>
        <CardContent className="py-12 text-center">
          <Database className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Data quality dashboard coming soon. Use the Integrity page for current checks.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
