'use client';

import { useState, useSyncExternalStore, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, Settings2 } from 'lucide-react';
import { posthog } from '@/lib/posthog';

const DEPTH_LABELS: Record<string, string> = {
  hands_off: 'Hands-Off',
  informed: 'Informed',
  engaged: 'Engaged',
  deep: 'Deep',
};

interface DepthUpgradeNudgeProps {
  /** What the user would unlock, e.g. "deeper governance analysis" */
  feature: string;
  /** The depth level that would unlock the feature */
  requiredDepth: string;
}

/** Read sessionStorage dismiss state without triggering lint warnings */
function useSessionDismissed(key: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
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
 * Block-level nudge shown at the bottom of sections when content is hidden
 * due to the user's governance depth setting. Dismissible per session.
 */
export function DepthUpgradeNudge({ feature, requiredDepth }: DepthUpgradeNudgeProps) {
  const storageKey = `depth_nudge_dismissed_${feature}`;
  const storageDismissed = useSessionDismissed(storageKey);
  const [localDismissed, setLocalDismissed] = useState(false);

  if (storageDismissed || localDismissed) return null;

  const depthLabel = DEPTH_LABELS[requiredDepth] ?? requiredDepth;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-4 py-3 mt-2">
      <div className="flex items-center gap-2 min-w-0">
        <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <p className="text-xs text-muted-foreground">
          Want {feature}?{' '}
          <Link
            href="/you/settings"
            onClick={() => {
              posthog?.capture('depth_upgrade_nudge_clicked', {
                feature,
                required_depth: requiredDepth,
                nudge_type: 'block',
              });
            }}
            className="font-medium text-primary hover:underline inline-flex items-center gap-0.5"
          >
            Switch to {depthLabel} depth
            <ArrowRight className="h-3 w-3" />
          </Link>
        </p>
      </div>
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
