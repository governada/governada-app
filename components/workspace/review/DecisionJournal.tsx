'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useJournalEntry, useSaveJournalEntry } from '@/hooks/useDecisionJournal';
import type { JournalPosition } from '@/lib/workspace/types';

interface DecisionJournalProps {
  proposalTxHash: string;
  proposalIndex: number;
  userId: string;
}

const POSITION_OPTIONS: { value: JournalPosition; label: string; color: string }[] = [
  {
    value: 'undecided',
    label: 'Undecided',
    color: 'border-muted-foreground/30 text-muted-foreground',
  },
  {
    value: 'lean_yes',
    label: 'Lean Yes',
    color: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
  },
  {
    value: 'lean_no',
    label: 'Lean No',
    color: 'border-rose-500/30 text-rose-600 dark:text-rose-400',
  },
  {
    value: 'lean_abstain',
    label: 'Lean Abstain',
    color: 'border-muted-foreground/30 text-muted-foreground',
  },
  {
    value: 'yes',
    label: 'Yes',
    color:
      'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium',
  },
  {
    value: 'no',
    label: 'No',
    color: 'border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium',
  },
  {
    value: 'abstain',
    label: 'Abstain',
    color: 'border-muted-foreground/50 bg-muted/30 text-muted-foreground font-medium',
  },
];

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return (
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    );
  } catch {
    return ts;
  }
}

function positionLabel(pos: string): string {
  return POSITION_OPTIONS.find((o) => o.value === pos)?.label ?? pos;
}

/**
 * DecisionJournal — collapsible card showing deliberation state.
 * Tracks position changes over time, with auto-save on changes.
 */
export function DecisionJournal({ proposalTxHash, proposalIndex, userId }: DecisionJournalProps) {
  const { data: existing, isLoading } = useJournalEntry(userId, proposalTxHash, proposalIndex);
  const { mutate: saveEntry, isPending: isSaving } = useSaveJournalEntry();

  const [expanded, setExpanded] = useState(true);
  const [position, setPosition] = useState<JournalPosition>('undecided');
  const [confidence, setConfidence] = useState(50);
  const [whatWouldChange, setWhatWouldChange] = useState('');
  const [hasEdited, setHasEdited] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from server data
  useEffect(() => {
    if (existing && !hasEdited) {
      setPosition(existing.position);
      setConfidence(existing.confidence);
      setWhatWouldChange(existing.whatWouldChangeMind);
    }
  }, [existing, hasEdited]);

  // Reset when proposal changes
  useEffect(() => {
    setPosition('undecided');
    setConfidence(50);
    setWhatWouldChange('');
    setHasEdited(false);
  }, [proposalTxHash, proposalIndex]);

  const doSave = useCallback(
    (pos: JournalPosition, conf: number, change: string) => {
      saveEntry(
        {
          proposalTxHash,
          proposalIndex,
          position: pos,
          confidence: conf,
          whatWouldChangeMind: change,
        },
        {
          onSuccess: () => {
            import('@/lib/posthog')
              .then(({ posthog }) => {
                posthog.capture('review_journal_updated', {
                  proposal_tx_hash: proposalTxHash,
                  proposal_index: proposalIndex,
                  position: pos,
                  confidence: conf,
                });
              })
              .catch(() => {});
          },
        },
      );
    },
    [proposalTxHash, proposalIndex, saveEntry],
  );

  const scheduleAutoSave = useCallback(
    (pos: JournalPosition, conf: number, change: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSave(pos, conf, change), 1500);
    },
    [doSave],
  );

  const handlePositionChange = (pos: JournalPosition) => {
    setPosition(pos);
    setHasEdited(true);
    // Save immediately on position change (important state)
    doSave(pos, confidence, whatWouldChange);
  };

  const handleConfidenceChange = (conf: number) => {
    setConfidence(conf);
    setHasEdited(true);
    scheduleAutoSave(position, conf, whatWouldChange);
  };

  const handleTextChange = (text: string) => {
    setWhatWouldChange(text);
    setHasEdited(true);
    scheduleAutoSave(position, confidence, text);
  };

  const positionHistory = existing?.positionHistory ?? [];

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-left"
          aria-label={expanded ? 'Collapse decision journal' : 'Expand decision journal'}
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            Decision Journal
            {isSaving && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {isLoading && (
          <div className="h-16 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {expanded && !isLoading && (
          <div className="space-y-3">
            {/* Position Selector */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Current Position</p>
              <div className="flex flex-wrap gap-1">
                {POSITION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handlePositionChange(opt.value)}
                    aria-label={`Set position to ${opt.label}`}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-md border transition-all',
                      position === opt.value
                        ? opt.color
                        : 'border-border text-muted-foreground hover:border-muted-foreground/40',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium">Confidence</p>
                <span className="text-xs font-medium tabular-nums">{confidence}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={confidence}
                onChange={(e) => handleConfidenceChange(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-muted accent-primary"
              />
            </div>

            {/* What would change my mind */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">
                What would change my mind?
              </p>
              <Textarea
                value={whatWouldChange}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="What evidence or argument would shift your position?"
                className="min-h-[60px] text-xs resize-y"
                maxLength={5000}
              />
            </div>

            {/* Position History */}
            {positionHistory.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Position History</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {positionHistory
                    .slice()
                    .reverse()
                    .map((entry, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="font-medium text-foreground/80">
                          {positionLabel(entry.position)}
                        </span>
                        <span className="text-muted-foreground/60">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
