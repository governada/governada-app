'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

/* ─── Dimension explanations ──────────────────────────── */

const EXPLAINERS: Record<string, string> = {
  treasury:
    'Your representative votes on treasury proposals. Last epoch, over \u20B310M was requested from the treasury — how it\u2019s spent shapes Cardano\u2019s future.',
  protocol:
    'Protocol security proposals affect how updates are reviewed and deployed. Your representative helps decide the pace of change vs. stability.',
  transparency:
    'Representatives who explain their votes help you understand why decisions are made. Transparency affects accountability across the ecosystem.',
  decentralization:
    'Some proposals affect how distributed Cardano\u2019s governance power is. Your representative\u2019s stance influences who shapes the network\u2019s direction.',
};

/* ─── Component ───────────────────────────────────────── */

interface QuizExplainerProps {
  dimension: string;
}

export function QuizExplainer({ dimension }: QuizExplainerProps) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  const text = EXPLAINERS[dimension];

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [open, text]);

  if (!text) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
        aria-expanded={open}
      >
        <Info className="h-3 w-3" />
        <span>{open ? 'Hide context' : 'Why this matters?'}</span>
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? `${height}px` : '0px', opacity: open ? 1 : 0 }}
      >
        <div ref={contentRef} className="pt-2 pb-1">
          <p className="text-xs text-muted-foreground/80 leading-relaxed max-w-md mx-auto text-center">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}
