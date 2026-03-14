'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSegment } from '@/components/providers/SegmentProvider';
import { Button } from '@/components/ui/button';

/**
 * WorkspacePage — Redirects DReps/SPOs to the homepage cockpit.
 *
 * The Governance Cockpit now lives on `/` for DReps and SPOs.
 * This page redirects them home. Non-DRep/SPO users see a message.
 * Sub-routes (e.g. /workspace/delegators) are unaffected — they
 * have their own page.tsx files.
 */
export function WorkspacePage() {
  const { segment } = useSegment();
  const router = useRouter();

  useEffect(() => {
    if (segment === 'drep' || segment === 'spo') {
      router.replace('/');
    }
  }, [segment, router]);

  // While redirecting, render nothing
  if (segment === 'drep' || segment === 'spo') {
    return null;
  }

  // Non-DRep/SPO users get a message
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 text-center space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Workspace</h1>
      <p className="text-muted-foreground">
        The workspace is for DReps and SPOs who actively participate in governance.
      </p>
      <Button asChild>
        <Link href="/">Back to Hub</Link>
      </Button>
    </div>
  );
}
