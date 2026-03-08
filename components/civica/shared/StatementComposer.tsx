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
import { Sparkles, Loader2 } from 'lucide-react';
import { getStoredSession } from '@/lib/supabaseAuth';

interface StatementComposerProps {
  open: boolean;
  onClose: () => void;
  drepId: string;
  onSuccess?: () => void;
}

export function StatementComposer({ open, onClose, drepId, onSuccess }: StatementComposerProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const MAX_CHARS = 1000;

  const handleDraftWithAI = async () => {
    const sessionToken = getStoredSession();
    if (!sessionToken) {
      setError('Please connect your wallet first');
      return;
    }

    setDrafting(true);
    setError(null);
    try {
      const res = await fetch(`/api/drep/${encodeURIComponent(drepId)}/draft-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken }),
      });
      if (res.ok) {
        const data = await res.json();
        setText(data.draft.slice(0, MAX_CHARS));
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to generate draft');
      }
    } catch (err) {
      console.error('Error generating AI draft', err);
      setError('Network error, please try again');
    } finally {
      setDrafting(false);
    }
  };

  const handleSubmit = async () => {
    if (!text.trim() || loading) return;

    const sessionToken = getStoredSession();
    if (!sessionToken) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/drep/${encodeURIComponent(drepId)}/statements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken, statementText: text.trim() }),
      });
      if (res.ok) {
        setText('');
        onSuccess?.();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to submit statement');
      }
    } catch (err) {
      console.error('Error submitting statement', err);
      setError('Network error, please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share a governance statement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Let your delegators know how you&apos;re thinking about governance. Your statements will
            appear on the Statements tab of your profile.
          </p>
          <div className="relative">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
              placeholder="Share your perspective on current governance activity..."
              className="min-h-[120px] resize-none"
              disabled={drafting}
            />
            <span
              className={`absolute bottom-2 right-2 text-xs ${
                text.length >= MAX_CHARS ? 'text-red-500' : 'text-muted-foreground'
              }`}
            >
              {text.length}/{MAX_CHARS}
            </span>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleDraftWithAI}
            disabled={drafting || loading}
          >
            {drafting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {drafting ? 'Drafting...' : 'Draft with AI'}
          </Button>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="ghost" onClick={onClose} disabled={loading || drafting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || drafting || !text.trim()}>
              {loading ? 'Sharing...' : 'Share statement'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
