'use client';

/**
 * CCArticleRow — individual article assessment row for CC Express Lane.
 *
 * Shows article name, verdict badge (PASS/ADVISORY/FAIL), reasoning,
 * confidence bar, and override controls.
 */

import { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArticleAssessment {
  article: string;
  verdict: 'PASS' | 'ADVISORY' | 'FAIL';
  reasoning: string;
  confidence: number;
  keyQuote?: string;
}

interface CCArticleRowProps {
  assessment: ArticleAssessment;
  isOverridden: boolean;
  overriddenVerdict?: 'PASS' | 'ADVISORY' | 'FAIL';
  onOverride: (article: string, newVerdict: 'PASS' | 'ADVISORY' | 'FAIL', reason: string) => void;
}

const VERDICT_CONFIG = {
  PASS: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10 border-emerald-400/40',
    label: 'PASS',
  },
  ADVISORY: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10 border-amber-400/40',
    label: 'ADVISORY',
  },
  FAIL: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-400/10 border-red-400/40',
    label: 'FAIL',
  },
} as const;

export function CCArticleRow({
  assessment,
  isOverridden,
  overriddenVerdict,
  onOverride,
}: CCArticleRowProps) {
  const [expanded, setExpanded] = useState(assessment.verdict !== 'PASS');
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  const displayVerdict = isOverridden && overriddenVerdict ? overriddenVerdict : assessment.verdict;
  const config = VERDICT_CONFIG[displayVerdict];
  const VerdictIcon = config.icon;

  return (
    <div className="border border-border/30 rounded-md overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/20 transition-colors cursor-pointer"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}

        {/* Article name */}
        <span className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">
          {assessment.article}
        </span>

        {/* Verdict badge */}
        <span
          className={cn(
            'px-1.5 py-0.5 text-[9px] font-bold rounded border shrink-0',
            config.bg,
            config.color,
          )}
        >
          {config.label}
        </span>

        {/* Provenance */}
        <span className="text-[8px] text-muted-foreground/50 shrink-0">
          {isOverridden ? 'Human' : 'AI'}
        </span>

        {/* Confidence bar */}
        <div
          className="w-8 h-1 rounded-full bg-muted/50 overflow-hidden shrink-0"
          title={`${Math.round(assessment.confidence * 100)}% confidence`}
        >
          <div
            className={cn('h-full rounded-full', config.color.replace('text-', 'bg-'))}
            style={{ width: `${assessment.confidence * 100}%` }}
          />
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-2.5 pb-2 pt-1 border-t border-border/20 space-y-2">
          <p className="text-[11px] text-foreground/70 leading-relaxed">{assessment.reasoning}</p>

          {assessment.keyQuote && (
            <p className="text-[10px] text-muted-foreground italic border-l-2 border-border/40 pl-2">
              &ldquo;{assessment.keyQuote}&rdquo;
            </p>
          )}

          {/* Override controls */}
          {!overrideOpen ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOverrideOpen(true);
              }}
              className="text-[10px] text-primary hover:text-primary/80 transition-colors cursor-pointer"
            >
              Override verdict
            </button>
          ) : (
            <div className="space-y-1.5 pt-1 border-t border-border/20">
              <div className="flex gap-1">
                {(['PASS', 'ADVISORY', 'FAIL'] as const).map((v) => {
                  const vc = VERDICT_CONFIG[v];
                  return (
                    <button
                      key={v}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOverride(
                          assessment.article,
                          v,
                          overrideReason.trim() ||
                            (v === assessment.verdict
                              ? 'Confirmed AI assessment'
                              : `Overridden to ${v}`),
                        );
                        setOverrideOpen(false);
                      }}
                      className={cn(
                        'flex-1 px-1.5 py-1 text-[9px] font-medium rounded border transition-colors cursor-pointer',
                        v === displayVerdict
                          ? cn(vc.bg, vc.color)
                          : 'border-border/30 text-muted-foreground hover:border-border/50',
                      )}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for override (optional)"
                className="w-full px-2 py-1 text-[10px] rounded border border-border/30 bg-muted/20 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOverrideOpen(false);
                }}
                className="text-[9px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
