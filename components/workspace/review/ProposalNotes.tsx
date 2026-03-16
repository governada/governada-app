'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Check, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useProposalNote, useSaveNote } from '@/hooks/useProposalNotes';

interface ProposalNotesProps {
  proposalTxHash: string;
  proposalIndex: number;
  userId: string;
}

/**
 * ProposalNotes — private notes sidebar panel for a proposal.
 * Auto-saves on blur with debounced protection.
 */
export function ProposalNotes({ proposalTxHash, proposalIndex, userId }: ProposalNotesProps) {
  const { data: existingNote, isLoading } = useProposalNote(userId, proposalTxHash, proposalIndex);
  const { mutate: saveNote, isPending: isSaving, isSuccess: justSaved } = useSaveNote();

  const [noteText, setNoteText] = useState('');
  const [hasEdited, setHasEdited] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef('');

  // Sync from server data on load
  useEffect(() => {
    if (existingNote?.noteText !== undefined && !hasEdited) {
      setNoteText(existingNote.noteText);
      lastSavedRef.current = existingNote.noteText;
    }
  }, [existingNote, hasEdited]);

  // Reset when proposal changes
  useEffect(() => {
    setNoteText('');
    setHasEdited(false);
    lastSavedRef.current = '';
  }, [proposalTxHash, proposalIndex]);

  const doSave = useCallback(
    (text: string) => {
      if (text === lastSavedRef.current) return;
      lastSavedRef.current = text;

      saveNote(
        { proposalTxHash, proposalIndex, noteText: text },
        {
          onSuccess: () => {
            import('@/lib/posthog')
              .then(({ posthog }) => {
                posthog.capture('review_note_saved', {
                  proposal_tx_hash: proposalTxHash,
                  proposal_index: proposalIndex,
                });
              })
              .catch(() => {});
          },
        },
      );
    },
    [proposalTxHash, proposalIndex, saveNote],
  );

  const handleChange = (text: string) => {
    setNoteText(text);
    setHasEdited(true);

    // Debounced auto-save
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSave(text), 2000);
  };

  const handleBlur = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    doSave(noteText);
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            My Notes
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {isSaving && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </>
            )}
            {!isSaving && justSaved && (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                Saved
              </>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="h-24 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Textarea
              value={noteText}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={handleBlur}
              placeholder="Private notes about this proposal..."
              className="min-h-[100px] text-sm resize-y"
              maxLength={50000}
            />
            <p className="text-[10px] text-muted-foreground tabular-nums text-right">
              {noteText.length.toLocaleString()} / 50,000
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
