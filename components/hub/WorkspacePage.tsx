'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSegment } from '@/components/providers/SegmentProvider';

/**
 * WorkspacePage — Smart redirect to the right workspace sub-page per persona.
 *
 * Workspace is actions-only (Review + Author). Each persona lands on their
 * primary workspace action:
 * - DReps/SPOs: Review queue (their #1 workspace JTBD)
 * - Citizens/CC: Proposal authoring
 * - Anonymous: Back to home
 */
export function WorkspacePage() {
  const { segment } = useSegment();
  const router = useRouter();

  useEffect(() => {
    switch (segment) {
      case 'drep':
      case 'spo':
        router.replace('/workspace/review');
        break;
      case 'citizen':
      case 'cc':
        router.replace('/workspace/author');
        break;
      default:
        router.replace('/');
        break;
    }
  }, [segment, router]);

  return null;
}
