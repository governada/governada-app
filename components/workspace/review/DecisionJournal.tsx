'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
  Lightbulb,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  Scale,
  ArrowRight,
} from 'lucide-react';
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

const POSITION_OPTIONS: {
  value: JournalPosition;
  label: string;
  icon: typeof HelpCircle;
  color: string;
  bgColor: string;
  dotColor: string;
}[] = [
  {
    value: 'undecided',
    label: 'Undecided',
    icon: HelpCircle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30 border-muted-foreground/20 hover:border-muted-foreground/40',
    dotColor: 'bg-muted-foreground',
  },
  {
    value: 'lean_yes',
    label: 'Lean Yes',
    icon: ThumbsUp,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40',
    dotColor: 'bg-emerald-400',
  },
  {
    value: 'lean_no',
    label: 'Lean No',
    icon: ThumbsDown,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40',
    dotColor: 'bg-rose-400',
  },
  {
    value: 'lean_abstain',
    label: 'Lean Abstain',
    icon: MinusCircle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30 border-muted-foreground/20 hover:border-muted-foreground/40',
    dotColor: 'bg-muted-foreground',
  },
  {
    value: 'yes',
    label: 'Yes',
    icon: ThumbsUp,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/40 hover:border-emerald-500/60',
    dotColor: 'bg-emerald-500',
  },
  {
    value: 'no',
    label: 'No',
    icon: ThumbsDown,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-500/10 border-rose-500/40 hover:border-rose-500/60',
    dotColor: 'bg-rose-500',
  },
  {
    value: 'abstain',
    label: 'Abstain',
    icon: MinusCircle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30 border-muted-foreground/30 hover:border-muted-foreground/50',
    dotColor: 'bg-slate-400',
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

function getPositionOption(pos: string) {
  return POSITION_OPTIONS.find((o) => o.value === pos);
}

function confidenceLabel(value: number): string {
  if (value <= 30) return 'Low confidence';
  if (value <= 70) return 'Moderately confident';
  return 'Highly confident';
}

function confidenceColor(value: number): string {
  if (value <= 30) return 'text-rose-500';
  if (value <= 70) return 'text-amber-500';
  return 'text-emerald-500';
}

/**
 * ConfidenceGauge — segmented visual bar replacing the native range slider.
 * Three zones: Low (0-30, red), Moderate (30-70, amber), High (70-100, green).
 * Click on a zone to jump, or use the hidden range input for precise control.
 */
function ConfidenceGauge({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const segments = [
    { min: 0, max: 30, label: 'Low', color: 'bg-rose-500', hoverColor: 'hover:bg-rose-500/20' },
    {
      min: 30,
      max: 70,
      label: 'Moderate',
      color: 'bg-amber-500',
      hoverColor: 'hover:bg-amber-500/20',
    },
    {
      min: 70,
      max: 100,
      label: 'High',
      color: 'bg-emerald-500',
      hoverColor: 'hover:bg-emerald-500/20',
    },
  ];

  return (
    <div className="space-y-1.5">
      {/* Segmented bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-muted/50 border border-border/50">
        {segments.map((seg) => {
          const isActive = value >= seg.min;
          const fillPercent =
            value <= seg.min
              ? 0
              : value >= seg.max
                ? 100
                : ((value - seg.min) / (seg.max - seg.min)) * 100;

          return (
            <button
              key={seg.label}
              className={cn(
                'relative flex-1 transition-colors cursor-pointer',
                seg.hoverColor,
                seg.min > 0 && 'border-l border-border/30',
              )}
              onClick={() => {
                // Jump to middle of segment
                const mid = Math.round((seg.min + seg.max) / 2);
                onChange(mid);
              }}
              aria-label={`Set confidence to ${seg.label}`}
            >
              <div
                className={cn('absolute inset-y-0 left-0 transition-all', seg.color)}
                style={{ width: isActive ? `${fillPercent}%` : '0%' }}
              />
            </button>
          );
        })}
      </div>

      {/* Range slider (hidden visually but functional for drag) */}
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 opacity-0 cursor-pointer absolute"
        style={{ marginTop: '-14px' }}
        aria-label="Confidence level"
      />

      {/* Label */}
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-medium', confidenceColor(value))}>
          {value}% — {confidenceLabel(value)}
        </span>
      </div>
    </div>
  );
}

/**
 * DecisionJournal — deliberation companion card.
 * Tracks position changes over time with visual timeline,
 * confidence gauge, and "what would change your mind" prompt.
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
          <div className="space-y-4">
            {/* Position Selector — 2x4 grid of colored cards */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Current Position</p>
              <div className="grid grid-cols-4 gap-1.5">
                {POSITION_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = position === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handlePositionChange(opt.value)}
                      aria-label={`Set position to ${opt.label}`}
                      className={cn(
                        'flex flex-col items-center justify-center gap-1 rounded-lg border p-2 min-h-[44px] transition-all',
                        isSelected
                          ? `${opt.bgColor} ring-2 ring-offset-1 ring-offset-background ring-current ${opt.color}`
                          : `border-border text-muted-foreground ${opt.bgColor.split(' ').pop()}`,
                      )}
                    >
                      <Icon
                        className={cn('h-4 w-4', isSelected ? opt.color : 'text-muted-foreground')}
                      />
                      <span
                        className={cn(
                          'text-[10px] leading-tight font-medium text-center',
                          isSelected ? opt.color : 'text-muted-foreground',
                        )}
                      >
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Confidence Gauge */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-medium">Confidence</p>
              </div>
              <ConfidenceGauge value={confidence} onChange={handleConfidenceChange} />
            </div>

            {/* What evidence would change your mind? */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-xs font-medium text-foreground">
                  What evidence would change your mind?
                </p>
              </div>
              <Textarea
                value={whatWouldChange}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Describe the specific evidence that would make you reconsider..."
                className="min-h-[60px] text-xs resize-y bg-transparent border-amber-500/20 focus:ring-amber-500/30"
                maxLength={5000}
              />
            </div>

            {/* Position History — visual timeline */}
            {positionHistory.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Position History</p>
                <div className="relative pl-4 space-y-2 max-h-40 overflow-y-auto">
                  {/* Timeline line */}
                  <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />

                  {positionHistory
                    .slice()
                    .reverse()
                    .map((entry, i) => {
                      const opt = getPositionOption(entry.position);
                      return (
                        <div key={i} className="relative flex items-start gap-2">
                          {/* Colored dot */}
                          <div
                            className={cn(
                              'absolute -left-4 top-1 h-3 w-3 rounded-full border-2 border-background shrink-0',
                              opt?.dotColor ?? 'bg-muted-foreground',
                            )}
                          />
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={cn(
                                'text-xs font-medium whitespace-nowrap',
                                opt?.color ?? 'text-foreground/80',
                              )}
                            >
                              {opt?.label ?? entry.position}
                            </span>
                            {i < positionHistory.length - 1 && (
                              <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0 hidden" />
                            )}
                            <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
                              {formatTimestamp(entry.timestamp)}
                            </span>
                          </div>
                          {entry.reason && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {entry.reason}
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
