'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Check, X, Pencil } from 'lucide-react';
import { useRespondToReview } from '@/hooks/useDraftReviews';
import type { DraftReview } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ResponseEditorProps {
  review: DraftReview;
  draftId: string;
  onSuccess: () => void;
}

export function ResponseEditor({ review, draftId, onSuccess }: ResponseEditorProps) {
  const respondToReview = useRespondToReview(draftId);

  const [selectedType, setSelectedType] = useState<'accept' | 'decline' | 'modify' | null>(null);
  const [responseText, setResponseText] = useState('');

  const handleSubmit = useCallback(async () => {
    if (!selectedType) return;
    // Accept can have optional response text; decline/modify require it
    if ((selectedType === 'decline' || selectedType === 'modify') && !responseText.trim()) return;

    await respondToReview.mutateAsync({
      reviewId: review.id,
      responseType: selectedType,
      responseText: responseText.trim() || 'Accepted — thank you for the feedback.',
    });

    setSelectedType(null);
    setResponseText('');
    onSuccess();
  }, [selectedType, responseText, respondToReview, review.id, onSuccess]);

  const handleCancel = useCallback(() => {
    setSelectedType(null);
    setResponseText('');
  }, []);

  if (!selectedType) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Respond:</span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 border-emerald-500/30 hover:bg-emerald-500/10"
          onClick={() => setSelectedType('accept')}
        >
          <Check className="h-3 w-3" />
          Accept
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 border-destructive/30 hover:bg-destructive/10"
          onClick={() => setSelectedType('decline')}
        >
          <X className="h-3 w-3" />
          Decline
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 border-amber-500/30 hover:bg-amber-500/10"
          onClick={() => setSelectedType('modify')}
        >
          <Pencil className="h-3 w-3" />
          Modify
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className={`text-xs ${
            selectedType === 'accept'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : selectedType === 'decline'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          }`}
        >
          {selectedType === 'accept' ? 'Accept' : selectedType === 'decline' ? 'Decline' : 'Modify'}
        </Badge>
      </div>

      <Textarea
        value={responseText}
        onChange={(e) => setResponseText(e.target.value)}
        placeholder={
          selectedType === 'accept'
            ? 'Optional response (or leave empty for default acceptance)...'
            : selectedType === 'decline'
              ? 'Explain why you are declining this feedback...'
              : 'Explain how you will modify based on this feedback...'
        }
        rows={3}
        maxLength={5000}
      />

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={
            respondToReview.isPending ||
            ((selectedType === 'decline' || selectedType === 'modify') && !responseText.trim())
          }
        >
          {respondToReview.isPending ? 'Submitting...' : 'Submit Response'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={respondToReview.isPending}
        >
          Cancel
        </Button>
      </div>

      {respondToReview.isError && (
        <p className="text-xs text-destructive">
          {respondToReview.error instanceof Error
            ? respondToReview.error.message
            : 'Failed to submit response'}
        </p>
      )}
    </div>
  );
}
