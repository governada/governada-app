'use client';

import { useState } from 'react';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageSquare, Send, Info, CheckCircle2 } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';

interface AskYourDRepProps {
  txHash: string;
  proposalIndex: number;
  proposalTitle: string;
}

export function AskYourDRep({ txHash, proposalIndex, proposalTitle }: AskYourDRepProps) {
  const { connected, isAuthenticated, delegatedDrepId, authenticate } = useWallet();
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show if user has a delegated DRep
  if (!connected || !delegatedDrepId) return null;

  const submit = async () => {
    if (!question.trim() || question.length > 500) return;
    hapticLight();

    if (!isAuthenticated) {
      const ok = await authenticate();
      if (!ok) return;
    }

    const token = getStoredSession();
    if (!token) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/governance/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionToken: token,
          drepId: delegatedDrepId,
          questionText: question.trim(),
          proposalTxHash: txHash,
          proposalIndex,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit');
      }

      setSubmitted(true);
      setQuestion('');

      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('citizen_question_asked', {
            proposal_tx_hash: txHash,
            proposal_index: proposalIndex,
            drep_id: delegatedDrepId,
          });
        })
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                Your question has been sent to your DRep. They&apos;ll see it in their inbox.
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={() => setSubmitted(false)}
            >
              Ask another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Ask Your DRep
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[260px]">
                <p className="text-xs">
                  Send a question to your delegated DRep about this proposal. They&apos;ll see it in
                  their Civica inbox with a link to this proposal.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Ask your DRep about &ldquo;{proposalTitle.slice(0, 80)}
          {proposalTitle.length > 80 ? '...' : ''}&rdquo;
        </p>
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What's your position on this proposal?"
          className="min-h-[80px] text-sm resize-none"
          maxLength={500}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{question.length}/500</span>
          <Button
            size="sm"
            onClick={submit}
            disabled={submitting || !question.trim()}
            className="gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            {submitting ? 'Sending...' : 'Send Question'}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
