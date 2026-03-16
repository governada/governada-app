'use client';

/**
 * Draft action buttons for the proposal authoring workspace.
 * Shows context-appropriate actions based on draft status.
 *
 * When draft is in 'final_comment' and governance_action_submission flag is on:
 *   - Shows "Submit On-Chain" button that opens the SubmissionFlow
 *
 * When draft is in 'submitted':
 *   - Shows submission details (tx hash, anchor URL)
 */

import { useState } from 'react';
import { Shield, ExternalLink, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FeatureGate, useFeatureFlag } from '@/components/FeatureGate';
import { SubmissionFlow } from './SubmissionFlow';
import { TeamManagement } from './TeamManagement';
import type { ProposalDraft, DraftVersion, TeamRole } from '@/lib/workspace/types';

interface DraftActionsProps {
  draft: ProposalDraft;
  versions?: DraftVersion[];
  onDraftUpdate?: (updates: Partial<ProposalDraft>) => void;
  /** Current user's stake address for ownership / team checks */
  viewerStakeAddress?: string | null;
  /** User's role on the team (null = not a member, undefined = not loaded) */
  userRole?: TeamRole | null;
}

/**
 * Shows submission details when the draft has been submitted on-chain.
 */
function SubmittedDetails({ draft }: { draft: ProposalDraft }) {
  if (!draft.submittedTxHash && !draft.submittedAnchorUrl) return null;

  const cardanoscanUrl = draft.submittedTxHash
    ? `https://cardanoscan.io/transaction/${draft.submittedTxHash}`
    : null;

  return (
    <Card className="border-emerald-500/20 bg-emerald-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheck className="h-4 w-4 text-emerald-400" />
          On-Chain Submission
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {draft.submittedTxHash && (
          <div>
            <p className="text-xs text-zinc-500">Transaction Hash</p>
            <div className="flex items-center gap-2">
              <code className="text-xs text-zinc-300 break-all">{draft.submittedTxHash}</code>
              {cardanoscanUrl && (
                <a
                  href={cardanoscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-zinc-400 hover:text-zinc-200"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}
        {draft.submittedAnchorUrl && (
          <div>
            <p className="text-xs text-zinc-500">Anchor URL</p>
            <code className="text-xs text-zinc-300 break-all">{draft.submittedAnchorUrl}</code>
          </div>
        )}
        {draft.submittedAnchorHash && (
          <div>
            <p className="text-xs text-zinc-500">Anchor Hash</p>
            <code className="text-xs text-zinc-300 break-all">{draft.submittedAnchorHash}</code>
          </div>
        )}
        {draft.submittedAt && (
          <div>
            <p className="text-xs text-zinc-500">Submitted</p>
            <p className="text-xs text-zinc-300">{new Date(draft.submittedAt).toLocaleString()}</p>
          </div>
        )}
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
          Submitted On-Chain
        </Badge>
      </CardContent>
    </Card>
  );
}

/**
 * Submit On-Chain button, only visible when feature flag is enabled
 * and draft is in the right status.
 */
function SubmitOnChainButton({
  draft,
  onDraftUpdate,
}: {
  draft: ProposalDraft;
  onDraftUpdate?: (updates: Partial<ProposalDraft>) => void;
}) {
  const [showFlow, setShowFlow] = useState(false);
  const flagEnabled = useFeatureFlag('governance_action_submission');

  // Only show for eligible statuses
  if (draft.status !== 'final_comment') return null;

  // Wait for flag check to complete
  if (flagEnabled === null || !flagEnabled) return null;

  if (showFlow) {
    return (
      <SubmissionFlow
        draft={draft}
        onClose={() => setShowFlow(false)}
        onSubmitted={(txHash, anchorUrl, anchorHash) => {
          onDraftUpdate?.({
            submittedTxHash: txHash,
            submittedAnchorUrl: anchorUrl,
            submittedAnchorHash: anchorHash,
            submittedAt: new Date().toISOString(),
            status: 'submitted',
          });
        }}
      />
    );
  }

  return (
    <Button
      onClick={() => setShowFlow(true)}
      className="w-full bg-amber-600 hover:bg-amber-700 text-white"
      size="lg"
    >
      <Shield className="h-4 w-4 mr-2" />
      Submit On-Chain
    </Button>
  );
}

/**
 * DraftActions: context-appropriate action buttons for proposal drafts.
 */
export function DraftActions({
  draft,
  onDraftUpdate,
  viewerStakeAddress,
  userRole,
}: DraftActionsProps) {
  const isOwner = !!viewerStakeAddress && viewerStakeAddress === draft.ownerStakeAddress;

  return (
    <div className="space-y-4">
      {/* Show submission details if already submitted */}
      {draft.status === 'submitted' && <SubmittedDetails draft={draft} />}

      {/* Show submit button when in final_comment and flag is on */}
      <FeatureGate flag="governance_action_submission">
        <SubmitOnChainButton draft={draft} onDraftUpdate={onDraftUpdate} />
      </FeatureGate>

      {/* Team management — visible to owners and team members */}
      {viewerStakeAddress && (isOwner || userRole) && (
        <TeamManagement
          draftId={draft.id}
          isOwner={isOwner}
          viewerStakeAddress={viewerStakeAddress}
        />
      )}
    </div>
  );
}
