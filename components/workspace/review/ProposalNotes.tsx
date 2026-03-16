'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Check, Loader2, Bold, Italic, List, Heading2, Eye, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { useProposalNote, useSaveNote } from '@/hooks/useProposalNotes';

interface ProposalNotesProps {
  proposalTxHash: string;
  proposalIndex: number;
  userId: string;
}

/**
 * Insert markdown syntax at cursor position in a textarea.
 * Returns [newText, newCursorPos].
 */
function insertMarkdownSyntax(
  textarea: HTMLTextAreaElement,
  text: string,
  syntax: 'bold' | 'italic' | 'checklist' | 'heading',
): [string, number] {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = text.slice(start, end);

  let before: string;
  let after: string;
  let insert: string;
  let cursorOffset: number;

  switch (syntax) {
    case 'bold':
      insert = selected ? `**${selected}**` : '**bold text**';
      before = text.slice(0, start);
      after = text.slice(end);
      cursorOffset = selected ? start + insert.length : start + 2;
      break;
    case 'italic':
      insert = selected ? `*${selected}*` : '*italic text*';
      before = text.slice(0, start);
      after = text.slice(end);
      cursorOffset = selected ? start + insert.length : start + 1;
      break;
    case 'checklist':
      insert = selected ? `- [ ] ${selected}` : '- [ ] ';
      // Insert at beginning of line
      {
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        before = text.slice(0, lineStart);
        after = text.slice(lineStart);
        // If we had selected text, replace; otherwise prepend to current line
        if (selected) {
          before = text.slice(0, start);
          after = text.slice(end);
        }
      }
      cursorOffset = start + insert.length;
      break;
    case 'heading':
      insert = selected ? `## ${selected}` : '## ';
      {
        const headLineStart = text.lastIndexOf('\n', start - 1) + 1;
        before = text.slice(0, headLineStart);
        after = text.slice(headLineStart);
        if (selected) {
          before = text.slice(0, start);
          after = text.slice(end);
        }
      }
      cursorOffset = start + insert.length;
      break;
  }

  return [before + insert + after, cursorOffset];
}

/**
 * ProposalNotes — private notes sidebar panel for a proposal.
 * Split view: editing textarea with markdown toolbar (top) + live preview (bottom).
 * Auto-saves on blur with debounced protection.
 */
export function ProposalNotes({ proposalTxHash, proposalIndex, userId }: ProposalNotesProps) {
  const { data: existingNote, isLoading } = useProposalNote(userId, proposalTxHash, proposalIndex);
  const { mutate: saveNote, isPending: isSaving, isSuccess: justSaved } = useSaveNote();

  const [noteText, setNoteText] = useState('');
  const [hasEdited, setHasEdited] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    setViewMode('edit');
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

  const handleToolbarAction = (syntax: 'bold' | 'italic' | 'checklist' | 'heading') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const [newText, cursorPos] = insertMarkdownSyntax(textarea, noteText, syntax);
    handleChange(newText);

    // Restore focus and cursor position after React re-render
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const toolbarButtons = [
    { action: 'bold' as const, icon: Bold, label: 'Bold' },
    { action: 'italic' as const, icon: Italic, label: 'Italic' },
    { action: 'checklist' as const, icon: List, label: 'Checklist' },
    { action: 'heading' as const, icon: Heading2, label: 'Heading' },
  ];

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
          <div className="space-y-2">
            {/* Toolbar + View Toggle */}
            <div className="flex items-center justify-between">
              {/* Markdown toolbar */}
              <div className="flex items-center gap-0.5">
                {toolbarButtons.map(({ action, icon: Icon, label }) => (
                  <Button
                    key={action}
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleToolbarAction(action)}
                    aria-label={label}
                    disabled={viewMode === 'preview'}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </Button>
                ))}
              </div>

              {/* View toggle */}
              <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
                <button
                  onClick={() => setViewMode('edit')}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors',
                    viewMode === 'edit'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  aria-label="Edit mode"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors',
                    viewMode === 'preview'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  aria-label="Preview mode"
                >
                  <Eye className="h-3 w-3" />
                  Preview
                </button>
              </div>
            </div>

            {/* Editor / Preview */}
            {viewMode === 'edit' ? (
              <textarea
                ref={textareaRef}
                value={noteText}
                onChange={(e) => handleChange(e.target.value)}
                onBlur={handleBlur}
                placeholder="Private notes about this proposal... (supports markdown)"
                className="w-full min-h-[100px] p-3 text-sm font-mono border rounded-lg bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                maxLength={50000}
              />
            ) : (
              <div className="min-h-[100px] p-3 border rounded-lg bg-muted/10 overflow-y-auto max-h-[300px]">
                {noteText.trim() ? (
                  <MarkdownRenderer content={noteText} compact />
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Nothing to preview. Switch to edit mode to write notes.
                  </p>
                )}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground tabular-nums text-right">
              {noteText.length.toLocaleString()} / 50,000
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
