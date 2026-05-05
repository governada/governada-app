export const dynamic = 'force-dynamic';

import { getDelegationMode } from '@/lib/delegation/mode';
import { DelegationTestClient } from './DelegationTestClient';

export default function DelegationTestPage() {
  const isSandboxPreview = getDelegationMode() === 'sandbox';

  if (process.env.NODE_ENV === 'production' && !isSandboxPreview) {
    return (
      <div className="container mx-auto p-8 text-center">
        <p className="text-muted-foreground">
          This page is only available in development or sandbox preview.
        </p>
      </div>
    );
  }

  return <DelegationTestClient />;
}
