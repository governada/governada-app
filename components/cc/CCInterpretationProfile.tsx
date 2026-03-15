'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookOpen, AlertTriangle, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { fadeInUp, staggerContainer } from '@/lib/animations';

interface InterpretationEntry {
  proposalTxHash: string;
  proposalIndex: number;
  epoch: number;
  stance: string; // 'strict' | 'moderate' | 'broad'
  summary: string | null;
  consistentWithPrior: boolean | null;
  driftNote: string | null;
}

interface InterpretationArticle {
  article: string;
  entries: InterpretationEntry[];
}

interface CCInterpretationProfileProps {
  interpretationHistory: InterpretationArticle[];
}

const STANCE_STYLES: Record<string, { text: string; border: string }> = {
  strict: { text: 'text-rose-500', border: 'border-rose-500/40' },
  moderate: { text: 'text-sky-500', border: 'border-sky-500/40' },
  broad: { text: 'text-emerald-500', border: 'border-emerald-500/40' },
};

const COLLAPSE_THRESHOLD = 3;

function ArticleTimeline({ article }: { article: InterpretationArticle }) {
  const [expanded, setExpanded] = useState(false);
  const entries = article.entries;
  const visibleEntries =
    expanded || entries.length <= COLLAPSE_THRESHOLD
      ? entries
      : entries.slice(0, COLLAPSE_THRESHOLD);
  const hiddenCount = entries.length - COLLAPSE_THRESHOLD;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{article.article}</h4>

      <div className="relative ml-3 pl-4 border-l border-border/40 space-y-3">
        {visibleEntries.map((entry, idx) => {
          const stanceStyle = STANCE_STYLES[entry.stance] ?? {
            text: 'text-muted-foreground',
            border: 'border-border',
          };

          return (
            <div key={`${entry.proposalTxHash}-${entry.proposalIndex}-${idx}`} className="relative">
              {/* Timeline dot */}
              <div className="absolute -left-[calc(1rem+4.5px)] top-1.5 h-2 w-2 rounded-full bg-border" />

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-[10px] font-mono tabular-nums">
                    Epoch {entry.epoch}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn('text-[10px] capitalize', stanceStyle.text, stanceStyle.border)}
                  >
                    {entry.stance}
                  </Badge>

                  {entry.consistentWithPrior === false && (
                    <span className="text-amber-500 flex items-center gap-0.5 text-[10px]">
                      <AlertTriangle className="h-3 w-3" />
                      Drift
                    </span>
                  )}
                  {entry.consistentWithPrior === true && (
                    <span className="text-emerald-500 flex items-center gap-0.5 text-[10px]">
                      <Check className="h-3 w-3" />
                      Consistent
                    </span>
                  )}
                </div>

                {entry.summary && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{entry.summary}</p>
                )}

                {entry.consistentWithPrior === false && entry.driftNote && (
                  <p className="text-xs text-amber-500/80 leading-relaxed">{entry.driftNote}</p>
                )}

                <Link
                  href={`/proposal/${entry.proposalTxHash}/${entry.proposalIndex}`}
                  className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                >
                  View proposal
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {entries.length > COLLAPSE_THRESHOLD && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 ml-7"
        >
          <ChevronDown className="h-3 w-3" />
          Show {hiddenCount} more
        </button>
      )}
    </div>
  );
}

export function CCInterpretationProfile({ interpretationHistory }: CCInterpretationProfileProps) {
  if (!interpretationHistory || interpretationHistory.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Constitutional Interpretation Profile
        </h3>
        <p className="text-sm text-muted-foreground">No interpretation data available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <BookOpen className="h-4 w-4" />
        Constitutional Interpretation Profile
      </h3>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-5"
      >
        {interpretationHistory.map((article) => (
          <motion.div key={article.article} variants={fadeInUp}>
            <ArticleTimeline article={article} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
