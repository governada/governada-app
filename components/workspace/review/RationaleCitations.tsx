'use client';

/**
 * RationaleCitations — collapsible panel showing constitutional citations,
 * precedent references, and key quotes generated alongside a rationale draft.
 *
 * Each citation is a clickable chip that inserts the reference text into
 * the rationale at the current cursor position (via onInsertCitation).
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, BookOpen, Scale, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { posthog } from '@/lib/posthog';

interface Citation {
  article: string;
  section?: string;
  relevance: string;
}

interface PrecedentRef {
  title: string;
  outcome: string;
  relevance: string;
}

interface KeyQuote {
  text: string;
  field: string;
}

interface RationaleCitationsProps {
  citations: Citation[];
  precedentRefs: PrecedentRef[];
  keyQuotes: KeyQuote[];
  onInsertCitation: (text: string) => void;
}

export function RationaleCitations({
  citations,
  precedentRefs,
  keyQuotes,
  onInsertCitation,
}: RationaleCitationsProps) {
  const [expanded, setExpanded] = useState(true);
  const totalRefs = citations.length + precedentRefs.length + keyQuotes.length;

  if (totalRefs === 0) return null;

  const handleInsert = (text: string, type: string) => {
    posthog.capture('rationale_citation_inserted', { type });
    onInsertCitation(text);
  };

  return (
    <div className="border border-border/30 rounded-md overflow-hidden mt-1.5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-muted/20 transition-colors cursor-pointer"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        <BookOpen className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-medium text-muted-foreground flex-1">
          References ({totalRefs})
        </span>
        <span className="text-[9px] text-muted-foreground/50">Click to insert</span>
      </button>

      {expanded && (
        <div className="px-2 pb-2 pt-0.5 space-y-2 border-t border-border/20">
          {/* Constitutional citations */}
          {citations.length > 0 && (
            <div>
              <div className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wide mb-1">
                Constitutional
              </div>
              <div className="flex flex-wrap gap-1">
                {citations.map((c, i) => (
                  <button
                    key={i}
                    onClick={() =>
                      handleInsert(
                        `[${c.article}${c.section ? `, ${c.section}` : ''}]`,
                        'constitutional',
                      )
                    }
                    title={c.relevance}
                    className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded',
                      'border border-[var(--compass-teal)]/30 text-[var(--compass-teal)]',
                      'hover:bg-[var(--compass-teal)]/10 transition-colors cursor-pointer',
                    )}
                  >
                    <Scale className="h-2.5 w-2.5" />
                    {c.article}
                    {c.section && (
                      <span className="text-[var(--compass-teal)]/60">{c.section}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Precedent references */}
          {precedentRefs.length > 0 && (
            <div>
              <div className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wide mb-1">
                Precedent
              </div>
              <div className="space-y-1">
                {precedentRefs.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleInsert(`[Ref: "${p.title}" — ${p.outcome}]`, 'precedent')}
                    title={p.relevance}
                    className={cn(
                      'w-full text-left flex items-start gap-1.5 px-1.5 py-1 text-[10px] rounded',
                      'border border-border/30 hover:bg-muted/20 transition-colors cursor-pointer',
                    )}
                  >
                    <BookOpen className="h-2.5 w-2.5 shrink-0 mt-0.5 text-muted-foreground" />
                    <div className="min-w-0">
                      <span className="font-medium text-foreground">{p.title}</span>
                      <span className="text-muted-foreground"> · {p.outcome}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Key quotes */}
          {keyQuotes.length > 0 && (
            <div>
              <div className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wide mb-1">
                Key Quotes
              </div>
              <div className="space-y-1">
                {keyQuotes.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleInsert(`"${q.text}"`, 'quote')}
                    className={cn(
                      'w-full text-left flex items-start gap-1.5 px-1.5 py-1 text-[10px] rounded',
                      'border border-border/30 hover:bg-muted/20 transition-colors cursor-pointer',
                    )}
                  >
                    <Quote className="h-2.5 w-2.5 shrink-0 mt-0.5 text-muted-foreground" />
                    <div className="min-w-0">
                      <span className="text-foreground/80 italic line-clamp-2">{q.text}</span>
                      <span className="text-muted-foreground/50 ml-1 capitalize">({q.field})</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
