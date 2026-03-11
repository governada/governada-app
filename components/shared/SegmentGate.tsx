'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import type { UserSegment } from '@/lib/walletDetection';

interface SegmentGateProps {
  /** Show children ONLY for these segments */
  show?: UserSegment[];
  /** Hide children for these segments */
  hide?: UserSegment[];
  children: React.ReactNode;
  /** Rendered when gated out */
  fallback?: React.ReactNode;
}

/**
 * Progressive disclosure gate based on user segment.
 *
 * Usage:
 *   <SegmentGate show={['drep', 'spo', 'cc']}>deep content</SegmentGate>
 *   <SegmentGate hide={['anonymous']}>auth-only content</SegmentGate>
 */
export function SegmentGate({ show, hide, children, fallback = null }: SegmentGateProps) {
  const { segment } = useSegment();

  if (show && !show.includes(segment)) return <>{fallback}</>;
  if (hide && hide.includes(segment)) return <>{fallback}</>;

  return <>{children}</>;
}
