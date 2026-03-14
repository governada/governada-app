'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';

type NudgeVariant = 'proposals' | 'representatives' | 'health';

const MESSAGES: Record<NudgeVariant, { text: string; cta: string; href: string }> = {
  proposals: {
    text: 'Want representation on these decisions?',
    cta: 'Find your DRep in 60 seconds',
    href: '/match',
  },
  representatives: {
    text: 'Not sure who to pick?',
    cta: 'Take the 60-second match quiz',
    href: '/match',
  },
  health: {
    text: 'This is your governance.',
    cta: 'Connect your wallet to see how you\u2019re represented',
    href: '/match',
  },
};

const STORAGE_KEY = 'governada_nudge_dismissed';

export function AnonymousNudge({ variant }: { variant: NudgeVariant }) {
  const { segment } = useSegment();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const map: Record<string, boolean> = raw ? JSON.parse(raw) : {};
      setDismissed(!!map[variant]);
    } catch {
      setDismissed(false);
    }
  }, [variant]);

  if (segment !== 'anonymous' || dismissed) return null;

  const { text, cta, href } = MESSAGES[variant];

  const dismiss = () => {
    setDismissed(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const map: Record<string, boolean> = raw ? JSON.parse(raw) : {};
      map[variant] = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {}
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
      <p className="flex-1 text-sm text-muted-foreground">
        {text}{' '}
        <Link href={href} className="font-medium text-primary hover:underline">
          {cta} &rarr;
        </Link>
      </p>
      <button
        onClick={dismiss}
        className="shrink-0 rounded p-1 text-muted-foreground/60 hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
