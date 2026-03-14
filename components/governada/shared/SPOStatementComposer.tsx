'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface SPOStatementComposerProps {
  open: boolean;
  onClose: () => void;
  poolId: string;
  onSuccess?: () => void;
}

export function SPOStatementComposer({
  open,
  onClose,
  poolId,
  onSuccess,
}: SPOStatementComposerProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const MAX_CHARS = 1000;

  const handleSubmit = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/spo/${encodeURIComponent(poolId)}/statements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement_text: text.trim() }),
      });
      if (res.ok) {
        setText('');
        onSuccess?.();
        onClose();
      } else {
        console.error('Failed to submit statement');
      }
    } catch (err) {
      console.error('Error submitting statement', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share your position</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Let delegators know how your pool approaches active governance proposals.
          </p>
          <div className="relative">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
              placeholder="Share your perspective on current governance activity…"
              className="min-h-[120px] resize-none"
            />
            <span
              className={`absolute bottom-2 right-2 text-xs ${
                text.length >= MAX_CHARS ? 'text-red-500' : 'text-muted-foreground'
              }`}
            >
              {text.length}/{MAX_CHARS}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !text.trim()}>
            {loading ? 'Sharing…' : 'Share statement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
