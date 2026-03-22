'use client';

import { Shield } from 'lucide-react';

interface SybilWarningProps {
  partnerCount: number;
  maxAgreementRate: number;
}

/**
 * A subtle but visible warning banner shown on flagged pool profiles.
 * Transparency is the defensibility argument — we show what we detect.
 * Factual, not accusatory.
 */
export function SybilWarning({ partnerCount, maxAgreementRate }: SybilWarningProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
      <Shield className="h-4 w-4 text-amber-400/80 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="text-sm text-amber-400/80">
          This pool&apos;s voting pattern is &gt;{Math.round(maxAgreementRate)}% identical to{' '}
          {partnerCount} other pool{partnerCount !== 1 ? 's' : ''}.
        </p>
        <p className="text-xs text-muted-foreground">
          This is detected automatically and may affect score confidence.
        </p>
      </div>
    </div>
  );
}
