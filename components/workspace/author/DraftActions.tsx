'use client';

/**
 * Draft action buttons for the proposal authoring workspace.
 * Shows context-appropriate actions based on draft status.
 *
 * Actions:
 *   - "Next Stage" — opens StageTransitionDialog for the draft owner
 *   - "Constitutional Check" — runs AI constitutional analysis
 *   - "Preview CIP-108" — generates and previews the CIP-108 metadata document
 *   - "Compare Versions" — opens VersionCompareDialog when 2+ versions exist
 *   - "Submit On-Chain" — opens SubmissionFlow (final_comment stage + flag)
 *   - Submission details when already submitted
 *   - Team management for owners / team members
 */

import { useState, useCallback } from 'react';
import {
  Shield,
  ExternalLink,
  FileCheck,
  ArrowRight,
  ShieldCheck,
  FileCode,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FeatureGate, useFeatureFlag } from '@/components/FeatureGate';
import { SubmissionFlow } from './SubmissionFlow';
import { StageTransitionDialog } from './StageTransitionDialog';
import { ConstitutionalCheckPanel } from './ConstitutionalCheckPanel';
import { CIP108PreviewModal } from './CIP108PreviewModal';
import { VersionCompareDialog } from './VersionCompareDialog';
import { TeamManagement } from './TeamManagement';
import { useConstitutionalCheck, useCip108Preview } from '@/hooks/useDrafts';
import { useQueryClient } from '@tanstack/react-query';
import type {
  ProposalDraft,
  DraftVersion,
  DraftStatus,
  TeamRole,
  ConstitutionalCheckResult,
  Cip108Document,
} from '@/lib/workspace/types';

interface DraftActionsProps {
  draft: ProposalDraft;
  versions?: DraftVersion[];
  onDraftUpdate?: (updates: Partial<ProposalDraft>) => void;
  /** Current user's stake address for ownership / team checks */
  viewerStakeAddress?: string | null;
  /** User's role on the team (null = not a member, undefined = not loaded) */
  userRole?: TeamRole | null;
}

// ---------------------------------------------------------------------------
// Valid stage transitions
// ---------------------------------------------------------------------------

const NEXT_STAGES: Partial<Record<DraftStatus, DraftStatus>> = {
  draft: 'community_review',
  community_review: 'response_revision',
  response_revision: 'final_comment',
  final_comment: 'submitted',
};

// ---------------------------------------------------------------------------
// SubmittedDetails — submission info display
// ---------------------------------------------------------------------------

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
            <p className="text-xs text-muted-foreground">Transaction Hash</p>
            <div className="flex items-center gap-2">
              <code className="text-xs text-foreground break-all">{draft.submittedTxHash}</code>
              {cardanoscanUrl && (
                <a
                  href={cardanoscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="View on CardanoScan"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}
        {draft.submittedAnchorUrl && (
          <div>
            <p className="text-xs text-muted-foreground">Anchor URL</p>
            <code className="text-xs text-foreground break-all">{draft.submittedAnchorUrl}</code>
          </div>
        )}
        {draft.submittedAnchorHash && (
          <div>
            <p className="text-xs text-muted-foreground">Anchor Hash</p>
            <code className="text-xs text-foreground break-all">{draft.submittedAnchorHash}</code>
          </div>
        )}
        {draft.submittedAt && (
          <div>
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="text-xs text-foreground">
              {new Date(draft.submittedAt).toLocaleString()}
            </p>
          </div>
        )}
        <Badge
          variant="outline"
          className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
        >
          Submitted On-Chain
        </Badge>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// SubmitOnChainButton
// ---------------------------------------------------------------------------

function SubmitOnChainButton({
  draft,
  onDraftUpdate,
}: {
  draft: ProposalDraft;
  onDraftUpdate?: (updates: Partial<ProposalDraft>) => void;
}) {
  const [showFlow, setShowFlow] = useState(false);
  const flagEnabled = useFeatureFlag('governance_action_submission');

  if (draft.status !== 'final_comment') return null;
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

// ---------------------------------------------------------------------------
// DraftActions — main export
// ---------------------------------------------------------------------------

export function DraftActions({
  draft,
  versions,
  onDraftUpdate,
  viewerStakeAddress,
  userRole,
}: DraftActionsProps) {
  const queryClient = useQueryClient();
  const isOwner = !!viewerStakeAddress && viewerStakeAddress === draft.ownerStakeAddress;
  const canManage = isOwner || userRole === 'lead';

  // Stage transition
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const nextStage = NEXT_STAGES[draft.status];

  // Constitutional check
  const constitutionalCheck = useConstitutionalCheck();
  const [checkResult, setCheckResult] = useState<ConstitutionalCheckResult | null>(null);

  const handleRunCheck = useCallback(() => {
    constitutionalCheck.mutate(
      {
        title: draft.title,
        abstract: draft.abstract || undefined,
        motivation: draft.motivation || undefined,
        rationale: draft.rationale || undefined,
        proposalType: draft.proposalType,
        typeSpecific: draft.typeSpecific ?? undefined,
      },
      {
        onSuccess: (result) => setCheckResult(result),
      },
    );
  }, [draft, constitutionalCheck]);

  // CIP-108 preview
  const cip108Preview = useCip108Preview();
  const [cip108Data, setCip108Data] = useState<{
    document: Cip108Document;
    contentHash: string;
  } | null>(null);
  const [cip108ModalOpen, setCip108ModalOpen] = useState(false);

  const handlePreviewCip108 = useCallback(() => {
    cip108Preview.mutate(
      {
        title: draft.title,
        abstract: draft.abstract || undefined,
        motivation: draft.motivation || undefined,
        rationale: draft.rationale || undefined,
      },
      {
        onSuccess: (data) => {
          setCip108Data(data);
          setCip108ModalOpen(true);
        },
      },
    );
  }, [draft, cip108Preview]);

  // Stage transition success
  const handleStageSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['author-draft', draft.id] });
    queryClient.invalidateQueries({ queryKey: ['author-drafts'] });
  }, [queryClient, draft.id]);

  return (
    <div className="space-y-4">
      {/* Show submission details if already submitted */}
      {draft.status === 'submitted' && <SubmittedDetails draft={draft} />}

      {/* Submit on-chain button (final_comment + flag) */}
      <FeatureGate flag="governance_action_submission">
        <SubmitOnChainButton draft={draft} onDraftUpdate={onDraftUpdate} />
      </FeatureGate>

      {/* Stage transition -- for owners/leads, when a next stage exists */}
      {canManage && nextStage && draft.status !== 'submitted' && (
        <>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setStageDialogOpen(true)}
            aria-label="Advance to next stage"
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Next Stage
          </Button>
          <StageTransitionDialog
            open={stageDialogOpen}
            onOpenChange={setStageDialogOpen}
            draftId={draft.id}
            currentStage={draft.status}
            targetStage={nextStage}
            onSuccess={handleStageSuccess}
          />
        </>
      )}

      {/* Constitutional Check -- available in draft and community_review */}
      {(draft.status === 'draft' ||
        draft.status === 'community_review' ||
        draft.status === 'response_revision') && (
        <div className="space-y-2">
          {checkResult ? (
            <ConstitutionalCheckPanel
              result={checkResult}
              onRerun={handleRunCheck}
              isRunning={constitutionalCheck.isPending}
            />
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleRunCheck}
              disabled={constitutionalCheck.isPending}
              aria-label="Run constitutional check"
            >
              {constitutionalCheck.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-2" />
              )}
              {constitutionalCheck.isPending ? 'Running Check...' : 'Constitutional Check'}
            </Button>
          )}
        </div>
      )}

      {/* CIP-108 Preview */}
      {draft.status !== 'archived' && (
        <>
          <Button
            variant="outline"
            className="w-full"
            onClick={handlePreviewCip108}
            disabled={cip108Preview.isPending}
            aria-label="Preview CIP-108 metadata"
          >
            {cip108Preview.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileCode className="h-4 w-4 mr-2" />
            )}
            {cip108Preview.isPending ? 'Generating...' : 'Preview CIP-108'}
          </Button>
          <CIP108PreviewModal
            open={cip108ModalOpen}
            onOpenChange={setCip108ModalOpen}
            data={cip108Data}
          />
        </>
      )}

      {/* Compare Versions -- when 2+ versions exist */}
      {versions && versions.length >= 2 && <VersionCompareDialog versions={versions} />}

      {/* Team management -- visible to owners and team members */}
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
