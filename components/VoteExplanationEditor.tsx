'use client';

import { useState, useCallback } from 'react';
import { posthog } from '@/lib/posthog';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Sparkles, Save, Loader2, PenLine, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VoteExplanationEditorProps {
  drepId: string;
  proposalTxHash: string;
  proposalIndex: number;
  proposalTitle: string;
  vote: string;
  existingExplanation?: string;
  onSaved?: (explanation: string) => void;
}

export function VoteExplanationEditor({
  drepId,
  proposalTxHash,
  proposalIndex,
  proposalTitle,
  vote,
  existingExplanation,
  onSaved,
}: VoteExplanationEditorProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(existingExplanation || '');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiAssisted, setAiAssisted] = useState(false);

  const handleAiGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/rationale/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drepId,
          proposalTitle,
          proposalAbstract: null,
          proposalType: 'Governance',
          aiSummary: null,
        }),
      });
      const data = await res.json();
      if (data.draft) {
        setText(data.draft);
        setAiAssisted(true);
        posthog.capture('vote_explanation_ai_generated', {
          drep_id: drepId,
          proposal_tx_hash: proposalTxHash,
        });
      }
    } catch {
      // Silently fail
    } finally {
      setGenerating(false);
    }
  }, [drepId, proposalTitle, proposalTxHash]);

  const handleSave = useCallback(async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const token = getStoredSession();
      if (!token) return;

      const res = await fetch(`/api/drep/${encodeURIComponent(drepId)}/explanations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: token,
          proposalTxHash,
          proposalIndex,
          explanationText: text.trim(),
          aiAssisted,
        }),
      });

      if (res.ok) {
        posthog.capture('vote_explanation_saved', {
          drep_id: drepId,
          proposal_tx_hash: proposalTxHash,
          ai_assisted: aiAssisted,
          length: text.trim().length,
        });
        onSaved?.(text.trim());
        setOpen(false);
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  }, [text, drepId, proposalTxHash, proposalIndex, aiAssisted, onSaved]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs h-7"
        onClick={() => setOpen(true)}
      >
        <PenLine className="h-3 w-3" />
        {existingExplanation ? 'Edit' : 'Explain'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-4 w-4" />
              Explain Your Vote
            </DialogTitle>
            <DialogDescription className="text-xs">{proposalTitle}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                You voted: {vote}
              </Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px]">
                    <p className="text-xs">
                      This explanation is stored on DRepScore and visible to your delegators. It
                      does not affect your on-chain rationale score.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <textarea
              className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Explain your reasoning for this vote..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleAiGenerate}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                AI Draft
              </Button>
              <div className="flex items-center gap-2">
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
                  )}
                  Save
                </Button>
              </div>
            </div>

            {aiAssisted && (
              <p className="text-[10px] text-muted-foreground">
                AI-assisted draft — edit before saving to add your personal perspective.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
