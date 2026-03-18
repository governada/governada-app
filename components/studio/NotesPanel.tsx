'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJournalEntry, useSaveJournalEntry } from '@/hooks/useDecisionJournal';
import type { JournalPosition } from '@/lib/workspace/types';

interface NotesPanelProps {
  proposalTxHash: string;
  proposalIndex: number;
  voterId: string | null;
}

const POSITION_OPTIONS: Array<{
  value: JournalPosition;
  label: string;
  color: string;
}> = [
  {
    value: 'lean_yes',
    label: 'Lean Yes',
    color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  },
  { value: 'lean_no', label: 'Lean No', color: 'text-red-400 border-red-500/40 bg-red-500/10' },
  {
    value: 'undecided',
    label: 'Undecided',
    color: 'text-zinc-400 border-zinc-500/40 bg-zinc-500/10',
  },
];

export function NotesPanel({ proposalTxHash, proposalIndex, voterId }: NotesPanelProps) {
  const { data: existingEntry, isLoading: isLoadingEntry } = useJournalEntry(
    voterId,
    proposalTxHash,
    proposalIndex,
  );
  const saveMutation = useSaveJournalEntry();

  const [position, setPosition] = useState<JournalPosition>('undecided');
  const [confidence, setConfidence] = useState(50);
  const [keyAssumptions, setKeyAssumptions] = useState('');
  const [whatWouldChangeMind, setWhatWouldChangeMind] = useState('');
  const [saved, setSaved] = useState(false);

  // Pre-populate from existing entry
  useEffect(() => {
    if (existingEntry) {
      setPosition(existingEntry.position);
      setConfidence(existingEntry.confidence);
      setKeyAssumptions(existingEntry.keyAssumptions || '');
      setWhatWouldChangeMind(existingEntry.whatWouldChangeMind || '');
    }
  }, [existingEntry]);

  // Reset saved indicator after 2s
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  const handleSave = useCallback(() => {
    saveMutation.mutate(
      {
        proposalTxHash,
        proposalIndex,
        position,
        confidence,
        keyAssumptions,
        whatWouldChangeMind,
      },
      {
        onSuccess: () => setSaved(true),
      },
    );
  }, [
    saveMutation,
    proposalTxHash,
    proposalIndex,
    position,
    confidence,
    keyAssumptions,
    whatWouldChangeMind,
  ]);

  if (!voterId) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-muted-foreground">Connect your wallet to keep decision notes.</p>
      </div>
    );
  }

  if (isLoadingEntry) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      {/* Position selector */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Position
        </label>
        <div className="flex gap-1.5">
          {POSITION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPosition(opt.value)}
              className={cn(
                'flex-1 px-2 py-1.5 text-xs rounded border transition-colors cursor-pointer',
                position === opt.value
                  ? opt.color
                  : 'text-muted-foreground border-border hover:border-muted-foreground/40',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Confidence slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Confidence
          </label>
          <span className="text-xs text-foreground tabular-nums font-medium">{confidence}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-muted/50 accent-primary cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground/50">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>

      {/* Key assumptions */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Key Assumptions
        </label>
        <textarea
          value={keyAssumptions}
          onChange={(e) => setKeyAssumptions(e.target.value)}
          placeholder="What assumptions is your position based on?"
          rows={3}
          className="w-full rounded-md border border-border bg-muted/20 px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
        />
      </div>

      {/* What would change your mind */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          What Would Change Your Mind
        </label>
        <textarea
          value={whatWouldChangeMind}
          onChange={(e) => setWhatWouldChangeMind(e.target.value)}
          placeholder="What evidence or arguments could shift your position?"
          rows={3}
          className="w-full rounded-md border border-border bg-muted/20 px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
        />
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer',
          saved
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-primary text-primary-foreground hover:bg-primary/90',
          saveMutation.isPending && 'opacity-60 cursor-not-allowed',
        )}
      >
        {saveMutation.isPending ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </>
        ) : saved ? (
          <>
            <CheckCircle2 className="h-3 w-3" />
            Saved
          </>
        ) : (
          <>
            <Save className="h-3 w-3" />
            Save Notes
          </>
        )}
      </button>

      {saveMutation.isError && (
        <p className="text-[11px] text-red-400">
          {saveMutation.error instanceof Error ? saveMutation.error.message : 'Failed to save'}
        </p>
      )}
    </div>
  );
}
