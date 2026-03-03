'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HelpCircle, Send, Loader2, MessageSquare } from 'lucide-react';
import { getStoredSession } from '@/lib/supabaseAuth';
import { posthog } from '@/lib/posthog';

interface QAItem {
  id: string;
  questionText: string;
  askerWallet: string;
  createdAt: string;
  status: string;
  response: { response_text: string; created_at: string } | null;
}

interface DRepQuestionsInboxProps {
  drepId: string;
}

export function DRepQuestionsInbox({ drepId }: DRepQuestionsInboxProps) {
  const [questions, setQuestions] = useState<QAItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(() => {
    fetch(`/api/governance/questions?drepId=${encodeURIComponent(drepId)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setQuestions)
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  }, [drepId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleRespond = async (questionId: string) => {
    const sessionToken = getStoredSession();
    if (!sessionToken || !responseText.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/governance/questions/${questionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken, responseText: responseText.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to submit response');
        return;
      }

      posthog.capture('question_responded_dashboard', { drep_id: drepId, question_id: questionId });
      setResponding(null);
      setResponseText('');
      fetchQuestions();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const openQuestions = questions.filter((q) => q.status === 'open');

  if (openQuestions.length === 0 && questions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Delegator Questions</CardTitle>
          {openQuestions.length > 0 && (
            <Badge variant="outline" className="text-xs tabular-nums">
              {openQuestions.length} unanswered
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {openQuestions.length > 0 ? (
          openQuestions.slice(0, 5).map((q) => (
            <div key={q.id} className="rounded-lg border p-3 space-y-2">
              <p className="text-sm">{q.questionText}</p>
              <p className="text-[10px] text-muted-foreground">
                From {q.askerWallet.slice(0, 12)}... ·{' '}
                {new Date(q.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </p>

              {responding === q.id ? (
                <div className="space-y-2 pt-1">
                  <Textarea
                    placeholder="Write your response..."
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    maxLength={2000}
                    rows={3}
                    className="resize-none text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {responseText.length}/2000
                    </span>
                    <div className="flex gap-2">
                      {error && <span className="text-xs text-destructive">{error}</span>}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setResponding(null);
                          setResponseText('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleRespond(q.id)}
                        disabled={submitting || !responseText.trim()}
                      >
                        {submitting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Respond
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setResponding(q.id);
                    setResponseText('');
                    setError(null);
                  }}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Reply
                </Button>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            All questions answered — great engagement!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
