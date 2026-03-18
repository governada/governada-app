'use client';

import { useMemo } from 'react';
import {
  MessageSquare,
  Highlighter,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  XCircle,
  MinusCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAnnotations } from '@/hooks/useAnnotations';

interface NotesPanelProps {
  proposalTxHash: string;
  proposalIndex: number;
  voterId: string | null;
  /** Prior votes submitted by this user for this proposal */
  priorVotes?: Array<{
    vote: string;
    epochNo: number;
    blockTime: string;
    rationale?: string | null;
  }>;
}

const ANNOTATION_TYPE_CONFIG: Record<
  string,
  { label: string; Icon: typeof MessageSquare; color: string }
> = {
  note: { label: 'Note', Icon: MessageSquare, color: 'text-blue-400' },
  highlight: { label: 'Highlight', Icon: Highlighter, color: 'text-amber-400' },
  concern: { label: 'Concern', Icon: AlertTriangle, color: 'text-red-400' },
  citation: { label: 'Citation', Icon: BookOpen, color: 'text-emerald-400' },
};

const FIELD_LABELS: Record<string, string> = {
  abstract: 'Abstract',
  motivation: 'Motivation',
  rationale: 'Rationale',
};

function VoteIcon({ vote }: { vote: string }) {
  const v = vote.toLowerCase();
  if (v === 'yes') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (v === 'no') return <XCircle className="h-3.5 w-3.5 text-red-400" />;
  return <MinusCircle className="h-3.5 w-3.5 text-zinc-400" />;
}

export function NotesPanel({
  proposalTxHash,
  proposalIndex,
  voterId,
  priorVotes,
}: NotesPanelProps) {
  const { data: annotations, isLoading: isLoadingAnnotations } = useAnnotations(
    proposalTxHash,
    proposalIndex,
  );

  // Filter to only show this user's annotations
  const myAnnotations = useMemo(() => {
    if (!annotations) return [];
    return annotations.filter((a) => a.userId === 'current' || a.userId === voterId);
  }, [annotations, voterId]);

  // Group annotations by field
  const annotationsByField = useMemo(() => {
    const grouped: Record<string, typeof myAnnotations> = {};
    for (const a of myAnnotations) {
      const field = a.anchorField || 'other';
      if (!grouped[field]) grouped[field] = [];
      grouped[field].push(a);
    }
    return grouped;
  }, [myAnnotations]);

  if (!voterId) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-muted-foreground">
          Connect your wallet to see your notes and vote history.
        </p>
      </div>
    );
  }

  const hasAnnotations = myAnnotations.length > 0;
  const hasVotes = priorVotes && priorVotes.length > 0;
  const isEmpty = !hasAnnotations && !hasVotes && !isLoadingAnnotations;

  return (
    <div className="p-3 space-y-4">
      {/* Inline annotations section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Your Markup
          </h3>
          {hasAnnotations && (
            <span className="text-[10px] text-muted-foreground/60 tabular-nums">
              {myAnnotations.length} annotation{myAnnotations.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {isLoadingAnnotations && (
          <div className="flex items-center gap-2 py-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Loading annotations...</span>
          </div>
        )}

        {!isLoadingAnnotations && hasAnnotations && (
          <div className="space-y-2">
            {Object.entries(annotationsByField).map(([field, items]) => (
              <div key={field} className="space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                  {FIELD_LABELS[field] || field}
                </span>
                {items.map((annotation) => {
                  const config =
                    ANNOTATION_TYPE_CONFIG[annotation.annotationType] ||
                    ANNOTATION_TYPE_CONFIG.note;
                  const Icon = config.Icon;
                  return (
                    <div
                      key={annotation.id}
                      className="rounded-md border border-border/50 bg-muted/10 px-2.5 py-2 space-y-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className={cn('h-3 w-3 shrink-0', config.color)} />
                        <span className={cn('text-[10px] font-medium', config.color)}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {annotation.annotationText}
                      </p>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {!isLoadingAnnotations && !hasAnnotations && (
          <div className="rounded-md border border-dashed border-border/50 px-3 py-4 text-center">
            <FileText className="h-4 w-4 mx-auto text-muted-foreground/30 mb-1.5" />
            <p className="text-[11px] text-muted-foreground/50">
              No annotations yet. Highlight text in the proposal to add notes, concerns, or
              citations.
            </p>
          </div>
        )}
      </div>

      {/* Prior votes section */}
      <div className="space-y-2 border-t border-border pt-3">
        <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Your Vote History
        </h3>

        {hasVotes ? (
          <div className="space-y-2">
            {priorVotes!.map((vote, i) => (
              <div
                key={i}
                className="rounded-md border border-border/50 bg-muted/10 px-2.5 py-2 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <VoteIcon vote={vote.vote} />
                    <span
                      className={cn(
                        'text-xs font-medium',
                        vote.vote.toLowerCase() === 'yes' && 'text-emerald-400',
                        vote.vote.toLowerCase() === 'no' && 'text-red-400',
                        vote.vote.toLowerCase() === 'abstain' && 'text-zinc-400',
                      )}
                    >
                      {vote.vote}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                    Epoch {vote.epochNo}
                  </span>
                </div>
                {vote.rationale && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                    {vote.rationale}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/50">No prior votes for this proposal.</p>
        )}
      </div>

      {isEmpty && (
        <p className="text-xs text-muted-foreground/40 text-center pt-2">
          Your annotations and vote history will appear here as you review.
        </p>
      )}
    </div>
  );
}
