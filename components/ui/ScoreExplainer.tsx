'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type ScoreType = 'drep' | 'spo';

const EXPLAINERS: Record<ScoreType, { pillars: string; summary: string }> = {
  drep: {
    pillars:
      'Engagement Quality (40%) · Participation (25%) · Reliability (25%) · Governance Identity (10%)',
    summary:
      'Higher scores mean this DRep votes consistently, explains their reasoning with quality rationales, and maintains an active governance presence.',
  },
  spo: {
    pillars: 'Participation (35%) · Deliberation (25%) · Reliability (25%) · Identity (15%)',
    summary:
      'Higher scores mean this SPO actively participates in governance votes, deliberates thoughtfully, and maintains a strong governance identity.',
  },
};

interface ScoreExplainerProps {
  type: ScoreType;
  className?: string;
}

export function ScoreExplainer({ type, className }: ScoreExplainerProps) {
  const [open, setOpen] = useState(false);
  const { pillars, summary } = EXPLAINERS[type];

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen((v) => !v)}
            className={className}
            aria-label="Why this score?"
          >
            <HelpCircle className="h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px] space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Score pillars
          </p>
          <p className="text-xs leading-relaxed">{pillars}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{summary}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
