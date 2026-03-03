'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { getStoredSession } from '@/lib/supabaseAuth';
import { useWallet } from '@/utils/wallet';
import { posthog } from '@/lib/posthog';

interface QuestionFormProps {
  drepId: string;
  onSubmitted: () => void;
}

export function QuestionForm({ drepId, onSubmitted }: QuestionFormProps) {
  const { isAuthenticated } = useWallet();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const charCount = text.length;
  const canSubmit = charCount > 0 && charCount <= 500 && !submitting;

  const handleSubmit = async () => {
    const sessionToken = getStoredSession();
    if (!sessionToken) {
      setError('Please connect your wallet first');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/governance/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken, drepId, questionText: text }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to submit question');
        return;
      }

      posthog.capture('question_form_submitted', { drep_id: drepId });
      setSuccess(true);
      setText('');
      onSubmitted();
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Network error, please try again');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Connect your wallet to ask this DRep a question
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Ask this DRep a question about their governance stance..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        rows={3}
        className="resize-none text-sm"
      />
      <div className="flex items-center justify-between">
        <span
          className={`text-xs tabular-nums ${charCount > 450 ? 'text-amber-500' : 'text-muted-foreground'}`}
        >
          {charCount}/500
        </span>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-destructive">{error}</span>}
          {success && <span className="text-xs text-green-500">Submitted!</span>}
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit} className="gap-1.5">
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Ask
          </Button>
        </div>
      </div>
    </div>
  );
}
