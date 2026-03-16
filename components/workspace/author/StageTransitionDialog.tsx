'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowRight, Check, X } from 'lucide-react';
import type { DraftStatus } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Stage labels
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<string, string> = {
  draft: 'Draft',
  community_review: 'Community Review',
  response_revision: 'Response & Revision',
  final_comment: 'Final Comment Period',
  submitted: 'Submitted',
  archived: 'Archived',
};

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      data.details ? (data.details as string[]).join('; ') : data.error || res.statusText,
    );
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StageTransitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftId: string;
  currentStage: DraftStatus;
  targetStage: DraftStatus;
  onSuccess: () => void;
}

export function StageTransitionDialog({
  open,
  onOpenChange,
  draftId,
  currentStage,
  targetStage,
  onSuccess,
}: StageTransitionDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setIsPending(false);
    }
  }, [open]);

  const handleConfirm = useCallback(async () => {
    setIsPending(true);
    setError(null);
    try {
      await postJson(`/api/workspace/drafts/${encodeURIComponent(draftId)}/stage`, {
        targetStage,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transition failed');
    } finally {
      setIsPending(false);
    }
  }, [draftId, targetStage, onSuccess, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Stage Transition</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Transition visualization */}
          <div className="flex items-center justify-center gap-3">
            <Badge variant="secondary" className="text-sm">
              {STAGE_LABELS[currentStage] ?? currentStage}
            </Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant="default" className="text-sm">
              {STAGE_LABELS[targetStage] ?? targetStage}
            </Badge>
          </div>

          {/* Stage-specific info */}
          {targetStage === 'community_review' && (
            <p className="text-sm text-muted-foreground">
              Your draft will be open for community review for a minimum of 48 hours. Reviewers can
              score and provide feedback on your proposal.
            </p>
          )}
          {targetStage === 'response_revision' && (
            <p className="text-sm text-muted-foreground">
              You will need to respond to all community reviews before progressing to the Final
              Comment Period.
            </p>
          )}
          {targetStage === 'final_comment' && (
            <p className="text-sm text-muted-foreground">
              The Final Comment Period lasts a minimum of 72 hours. No new reviews will be accepted.
            </p>
          )}
          {targetStage === 'submitted' && (
            <p className="text-sm text-muted-foreground">
              This marks the proposal as submitted. The draft will become read-only.
            </p>
          )}
          {targetStage === 'archived' && (
            <p className="text-sm text-muted-foreground">
              Archiving hides this draft from your active list. You can still view it later.
            </p>
          )}

          {/* Error display */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
              <AlertCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
              <div className="text-sm text-destructive space-y-1">
                {error.split('; ').map((msg, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <X className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{msg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? (
              'Transitioning...'
            ) : (
              <>
                <Check className="mr-1.5 h-4 w-4" />
                Confirm Transition
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
