'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, X } from 'lucide-react';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';

const STORAGE_KEY = 'cc-explainer-dismissed';

export function CCExplainerBanner({ memberCount }: { memberCount?: number }) {
  const { depth } = useGovernanceDepth();
  const [dismissed, setDismissed] = useState(true); // default hidden to avoid flash

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  if (depth !== 'informed' || dismissed) return null;

  const countText = memberCount ? `${memberCount} members` : 'elected members';

  return (
    <div className="relative flex items-start gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3">
      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
      <div className="min-w-0 flex-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">What is the Constitutional Committee?</span> A
        group of {countText} who check whether governance proposals comply with Cardano&apos;s
        constitution. They can approve or block unconstitutional proposals.{' '}
        <Link
          href="/governance/committee/data"
          className="text-sky-400 hover:text-sky-300 transition-colors"
        >
          Learn more &rarr;
        </Link>
      </div>
      <button
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, '1');
          setDismissed(true);
        }}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss explainer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
