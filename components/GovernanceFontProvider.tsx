'use client';

import { useEffect } from 'react';
import { useFeatureFlag } from '@/components/FeatureGate';

/**
 * Feature-flagged governance font switcher.
 *
 * When the `governance_font` flag is enabled, sets a `data-font="governance"`
 * attribute on <body>. CSS in globals.css uses this to swap
 * --font-governada-display from Geist Sans to Space Grotesk.
 *
 * Toggle via /admin/flags or env var FF_GOVERNANCE_FONT=true.
 */
export function GovernanceFontProvider() {
  const enabled = useFeatureFlag('governance_font');

  useEffect(() => {
    if (enabled === null) return;
    if (enabled) {
      document.body.setAttribute('data-font', 'governance');
    } else {
      document.body.removeAttribute('data-font');
    }
    return () => {
      document.body.removeAttribute('data-font');
    };
  }, [enabled]);

  return null;
}
