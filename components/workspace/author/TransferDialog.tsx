'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTransferDraft } from '@/hooks/useDraftActions';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftId: string;
  draftTitle: string;
  ownerStakeAddress: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransferDialog({
  open,
  onOpenChange,
  draftId,
  draftTitle,
  ownerStakeAddress,
}: TransferDialogProps) {
  const [newOwner, setNewOwner] = useState('');
  const transferMutation = useTransferDraft(ownerStakeAddress);

  const handleTransfer = () => {
    if (!newOwner.trim()) return;
    transferMutation.mutate(
      { draftId, newOwnerStakeAddress: newOwner.trim() },
      {
        onSuccess: () => {
          setNewOwner('');
          onOpenChange(false);
        },
      },
    );
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setNewOwner('');
    }
    onOpenChange(next);
  };

  const isValid = newOwner.trim().length > 0 && newOwner.trim() !== ownerStakeAddress;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Ownership</DialogTitle>
          <DialogDescription>
            Transfer &ldquo;{draftTitle || 'Untitled Draft'}&rdquo; to a new owner. This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="new-owner-address">New owner stake address</Label>
          <Input
            id="new-owner-address"
            placeholder="stake1..."
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
            className="font-mono text-sm"
          />
          {newOwner.trim() === ownerStakeAddress && (
            <p className="text-xs text-destructive">Cannot transfer to the current owner.</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={transferMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={!isValid || transferMutation.isPending}>
            {transferMutation.isPending ? 'Transferring...' : 'Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
