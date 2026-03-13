'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { useWallet } from '@/utils/wallet-context';
import { useSegment } from '@/components/providers/SegmentProvider';

const STORAGE_KEY = 'depth_footer_dismissed';

/**
 * Subtle footer shown to Hands-Off and Informed users at the bottom of the Hub,
 * nudging them to explore deeper governance depth settings.
 */
export function DepthDiscoveryFooter() {
  const { segment } = useSegment();
  const { connected, isAuthenticated } = useWallet();
  const { depth } = useGovernanceDepth();
  const [dismissed, setDismissed] = useState(true); // default hidden until check

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  // Only show for authenticated, non-anonymous users on hands_off or informed depth
  if (
    !connected ||
    !isAuthenticated ||
    segment === 'anonymous' ||
    dismissed ||
    (depth !== 'hands_off' && depth !== 'informed')
  ) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Seeing less than expected? Adjust your governance depth to see more.{' '}
        <Link href="/you/settings" className="font-medium text-primary hover:underline">
          Change depth
        </Link>
      </p>
      <button
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, '1');
          setDismissed(true);
        }}
        className="shrink-0 rounded-sm p-0.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
