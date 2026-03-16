'use client';

import { useState, useCallback } from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { posthog } from '@/lib/posthog';

interface QuestionGateProps {
  txHash: string;
  index: number;
  voterId: string;
  onQuestionSubmitted: () => void;
  onSkip: () => void;
}

function getStorageKey(voterId: string, txHash: string, index: number): string {
  return `question_${voterId}_${txHash}_${index}`;
}

/**
 * Check if a question has been submitted for this proposal.
 * Used by parent components to determine initial gate state.
 */
export function hasSubmittedQuestion(voterId: string, txHash: string, index: number): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(getStorageKey(voterId, txHash, index)) !== null;
}

export function QuestionGate({
  txHash,
  index,
  voterId,
  onQuestionSubmitted,
  onSkip,
}: QuestionGateProps) {
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(() => {
    if (!question.trim()) return;

    setSubmitting(true);

    // Store question locally (Wave 1 — localStorage only)
    const key = getStorageKey(voterId, txHash, index);
    localStorage.setItem(
      key,
      JSON.stringify({
        question: question.trim(),
        submittedAt: new Date().toISOString(),
      }),
    );

    posthog.capture('review_question_submitted', {
      txHash,
      index,
      questionLength: question.trim().length,
    });

    setSubmitting(false);
    onQuestionSubmitted();
  }, [question, voterId, txHash, index, onQuestionSubmitted]);

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="size-5 text-indigo-400" />
        <h3 className="text-sm font-semibold">
          Ask one question about this proposal before voting
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        The Socratic method: forming a question helps you identify what matters most about this
        proposal. Your question will be saved in your decision journal.
      </p>
      <Textarea
        placeholder="What would you ask the proposal authors?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        className="min-h-20 resize-none"
        maxLength={500}
      />
      <div className="flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Skip
        </button>
        <Button size="sm" onClick={handleSubmit} disabled={!question.trim() || submitting}>
          Submit Question
        </Button>
      </div>
    </div>
  );
}
