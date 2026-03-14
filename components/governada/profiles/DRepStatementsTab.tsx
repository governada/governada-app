'use client';

import { useState, useCallback } from 'react';
import { PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/utils/wallet';
import { DRepCommunicationFeed } from '@/components/DRepCommunicationFeed';
import { StatementComposer } from '@/components/governada/shared/StatementComposer';

interface DRepStatementsTabProps {
  drepId: string;
}

/**
 * Statements tab content for the DRep profile.
 * Shows the DRepCommunicationFeed (vote explanations, positions, epoch updates, Q&A)
 * and, for the DRep owner, a "Write Statement" button that opens the StatementComposer.
 */
export function DRepStatementsTab({ drepId }: DRepStatementsTabProps) {
  const { isAuthenticated, ownDRepId } = useWallet();
  const [composerOpen, setComposerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isOwner = isAuthenticated && ownDRepId === drepId;

  const handleStatementSuccess = useCallback(() => {
    // Bump the key to force the feed to re-fetch
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-4">
      {isOwner && (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Share your governance perspective</p>
            <p className="text-xs text-muted-foreground">
              Let your delegators know what you&apos;re thinking
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setComposerOpen(true)}>
            <PenLine className="h-3.5 w-3.5" />
            Write Statement
          </Button>
        </div>
      )}

      <DRepCommunicationFeed key={refreshKey} drepId={drepId} />

      {isOwner && (
        <StatementComposer
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          drepId={drepId}
          onSuccess={handleStatementSuccess}
        />
      )}
    </div>
  );
}
