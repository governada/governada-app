'use client';

/**
 * AmendmentEntryDialog — Entry point dialog for constitutional amendments.
 *
 * Offers two paths:
 * - Path A: "Edit the Constitution" — direct editor
 * - Path B: "Describe Your Intent" — AI-assisted translation
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileEdit, Sparkles, Loader2 } from 'lucide-react';

export interface AmendmentEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartDirect: () => void;
  onStartIntent: () => void;
  isPending: boolean;
}

export function AmendmentEntryDialog({
  open,
  onOpenChange,
  onStartDirect,
  onStartIntent,
  isPending,
}: AmendmentEntryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>How would you like to start?</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {/* Path A: Direct editor */}
          <button
            onClick={onStartDirect}
            disabled={isPending}
            className="flex items-start gap-4 p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted shrink-0">
              {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <FileEdit className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="space-y-1 min-w-0">
              <span className="text-sm font-medium">Edit the Constitution</span>
              <p className="text-xs text-muted-foreground leading-snug">
                Open the full constitution text and make changes directly. Use suggest mode to
                propose amendments article by article.
              </p>
            </div>
          </button>

          {/* Path B: AI-assisted intent */}
          <button
            onClick={onStartIntent}
            disabled={isPending}
            className="flex items-start gap-4 p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted shrink-0">
              {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <Sparkles className="h-5 w-5 text-amber-400" />
              )}
            </div>
            <div className="space-y-1 min-w-0">
              <span className="text-sm font-medium">Describe Your Intent</span>
              <p className="text-xs text-muted-foreground leading-snug">
                Describe what you want to change in plain language and let AI identify the relevant
                articles and draft specific amendments.
              </p>
            </div>
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground/60 text-center">
          You can switch between modes at any time during editing.
        </p>
      </DialogContent>
    </Dialog>
  );
}
