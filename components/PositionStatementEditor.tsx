'use client';

import { useState, useCallback } from 'react';
import { posthog } from '@/lib/posthog';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { MessageSquare, Save, Loader2 } from 'lucide-react';

interface PositionStatementEditorProps {
  drepId: string;
  proposalTxHash: string;
  proposalIndex: number;
  proposalTitle: string;
  existingStatement?: string;
  onSaved?: (text: string) => void;
}

export function PositionStatementEditor({
  drepId,
  proposalTxHash,
  proposalIndex,
  proposalTitle,
  existingStatement,
  onSaved,
}: PositionStatementEditorProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(existingStatement || '');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const token = getStoredSession();
      if (!token) return;
      const res = await fetch(`/api/drep/${encodeURIComponent(drepId)}/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: token,
          proposalTxHash,
          proposalIndex,
          statementText: text.trim(),
        }),
      });
      if (res.ok) {
        posthog.capture('position_statement_saved', {
          drep_id: drepId,
          proposal_tx_hash: proposalTxHash,
        });
        onSaved?.(text.trim());
        setOpen(false);
      }
    } catch {
    } finally {
      setSaving(false);
    }
  }, [text, drepId, proposalTxHash, proposalIndex, onSaved]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-[10px] gap-1"
        onClick={() => setOpen(true)}
      >
        <MessageSquare className="h-3 w-3" />
        Position
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              State Your Position
            </DialogTitle>
            <DialogDescription className="text-xs">{proposalTitle}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Share your stance and reasoning on this proposal..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleSave}
                disabled={saving || !text.trim()}
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}{' '}
                Publish
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Visible to delegators on the proposal page.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
