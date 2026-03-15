'use client';

import { useState, useSyncExternalStore, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { posthog } from '@/lib/posthog';

const DEPTH_LABELS: Record<string, string> = {
  hands_off: 'Hands-Off',
  informed: 'Informed',
  engaged: 'Engaged',
  deep: 'Deep',
};

interface DepthUpgradeInlineProps {
  /** How many items are hidden at the current depth */
  hiddenCount: number;
  /** The depth level that would reveal the hidden items */
  requiredDepth: string;
  /** What the user would unlock, e.g. "headlines", "sections" */
  feature: string;
}

/** Read sessionStorage dismiss state without triggering lint warnings */
function useSessionDismissed(key: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      // Storage events fire across tabs; for same-tab we rely on local state
      const handler = (e: StorageEvent) => {
        if (e.key === key) cb();
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    },
    [key],
  );

  const getSnapshot = useCallback(() => {
    try {
      return sessionStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  }, [key]);

  // SSR: default to hidden (dismissed = true) to avoid flash
  const getServerSnapshot = useCallback(() => true, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Subtle inline text nudge shown at truncation points, encouraging users
 * to increase their governance depth to see more content.
 *
 * Dismissible per session via sessionStorage.
 */
export function DepthUpgradeInline({
  hiddenCount,
  requiredDepth,
  feature,
}: DepthUpgradeInlineProps) {
  const storageKey = `depth_inline_dismissed_${feature}`;
  const storageDismissed = useSessionDismissed(storageKey);
  const [localDismissed, setLocalDismissed] = useState(false);

  if (storageDismissed || localDismissed || hiddenCount <= 0) return null;

  const depthLabel = DEPTH_LABELS[requiredDepth] ?? requiredDepth;

  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <Link
        href="/you/settings"
        onClick={() => {
          posthog?.capture('depth_upgrade_nudge_clicked', {
            feature,
            required_depth: requiredDepth,
            hidden_count: hiddenCount,
            nudge_type: 'inline',
          });
        }}
        className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
      >
        {hiddenCount} more {feature} at {depthLabel} depth
        <ArrowRight className="h-3 w-3" />
      </Link>
      <button
        onClick={() => {
          try {
            sessionStorage.setItem(storageKey, '1');
          } catch {
            /* storage unavailable */
          }
          setLocalDismissed(true);
        }}
        className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
        aria-label="Dismiss"
      >
        dismiss
      </button>
    </div>
  );
}
