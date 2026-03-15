'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';
import type { CCBriefing } from '@/hooks/queries';

// ---------------------------------------------------------------------------
// Severity badge colors
// ---------------------------------------------------------------------------

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  concern: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  noteworthy: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  info: 'bg-muted text-muted-foreground border-border/40',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CCBriefingCardProps {
  briefing: CCBriefing | null;
}

export function CCBriefingCard({ briefing }: CCBriefingCardProps) {
  const [showFindings, setShowFindings] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  if (!briefing) return null;

  return (
    <motion.div
      variants={fadeInUp}
      className="rounded-xl border border-border/60 bg-card/30 p-5 sm:p-6 space-y-3"
    >
      {/* Headline */}
      <p className="text-base font-semibold leading-snug">{briefing.headline}</p>

      {/* What changed */}
      {briefing.whatChanged && (
        <div className="text-sm text-muted-foreground leading-relaxed">
          {briefing.whatChanged
            .split('\n')
            .filter(Boolean)
            .map((line, idx) => (
              <p key={idx} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                <span>{line.replace(/^[-*]\s*/, '')}</span>
              </p>
            ))}
        </div>
      )}

      {/* Key findings — collapsible */}
      {briefing.keyFindings && briefing.keyFindings.length > 0 && (
        <div>
          <button
            onClick={() => setShowFindings(!showFindings)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showFindings ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {showFindings ? 'Hide findings' : `Show findings (${briefing.keyFindings.length})`}
          </button>

          {showFindings && (
            <div className="mt-2 space-y-2">
              {briefing.keyFindings.map((f, idx) => {
                const severityStyle = SEVERITY_STYLES[f.severity] || SEVERITY_STYLES.info;
                return (
                  <div key={idx} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={cn(
                        'mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none',
                        severityStyle,
                      )}
                    >
                      {f.severity}
                    </span>
                    <span className="text-muted-foreground leading-relaxed">{f.finding}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Executive summary — collapsible */}
      {briefing.executiveSummary && (
        <div>
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showSummary ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {showSummary ? 'Hide summary' : 'Executive summary'}
          </button>

          {showSummary && (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {briefing.executiveSummary}
            </p>
          )}
        </div>
      )}

      {/* AI attribution */}
      <div className="flex items-center gap-1.5 pt-1">
        <Sparkles className="h-3 w-3 text-muted-foreground/50" />
        <span className="text-[10px] text-muted-foreground/50">AI-generated briefing</span>
      </div>
    </motion.div>
  );
}
