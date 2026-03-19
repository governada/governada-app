'use client';

/**
 * TeamSignOff — Step 3 of the submission ceremony.
 *
 * BLOCKING GATE — the "Continue" button is disabled until all editors
 * have recorded their approval. The lead has implicit approval and can
 * always proceed. Solo proposers (no team) skip through automatically.
 */

import { Users, UserCircle, ArrowLeft, ArrowRight, Check, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTeam } from '@/hooks/useTeam';
import { useTeamApprovals, useApproveSubmission } from '@/hooks/useTeamApprovals';
import { useSegment } from '@/components/providers/SegmentProvider';
import type { TeamRole } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TeamSignOffProps {
  draftId: string;
  onContinue: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<TeamRole, string> = {
  lead: 'Lead',
  editor: 'Editor',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<TeamRole, string> = {
  lead: 'border-[var(--compass-teal)]/40 text-[var(--compass-teal)]',
  editor: 'border-[var(--wayfinder-amber)]/40 text-[var(--wayfinder-amber)]',
  viewer: 'border-border text-muted-foreground',
};

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TeamSignOff({ draftId, onContinue, onBack }: TeamSignOffProps) {
  const { stakeAddress } = useSegment();
  const { data: teamData, isLoading: teamLoading } = useTeam(draftId);
  const { data: approvalsData, isLoading: approvalsLoading } = useTeamApprovals(draftId);
  const approveMutation = useApproveSubmission(draftId);

  const team = teamData?.team ?? null;
  const members = teamData?.members ?? [];

  const isLoading = teamLoading || approvalsLoading;

  // Determine if the current user is the lead
  const currentMember = members.find((m) => m.stakeAddress === stakeAddress);
  const isLead = currentMember?.role === 'lead';
  const isEditor = currentMember?.role === 'editor';

  // Approval state
  const allApproved = approvalsData?.allApproved ?? true;
  const pendingCount = approvalsData?.pendingCount ?? 0;
  const approvals = approvalsData?.approvals ?? [];

  // Build a lookup: memberId -> approvedAt
  const approvalMap = new Map<string, string | null>();
  for (const a of approvals) {
    approvalMap.set(a.memberId, a.approvedAt);
  }

  // Can the current user approve?
  const currentMemberApproval = isEditor
    ? approvals.find((a) => a.stakeAddress === stakeAddress)
    : null;
  const hasApproved = currentMemberApproval?.approvedAt != null;
  const canApprove = isEditor && !hasApproved;

  // Continue is enabled if: solo proposer, all approved, or lead (implicit approval)
  const canContinue = !team || allApproved || isLead;

  const handleApprove = () => {
    if (!stakeAddress) return;
    approveMutation.mutate({ stakeAddress });
  };

  // No team — solo proposer
  if (!isLoading && !team) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <UserCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Solo Proposer</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            No team has been created for this proposal. You are submitting as a solo proposer.
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={onContinue} className="flex-1">
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="mx-auto w-8 h-8 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading team information...</p>
        </div>
      </div>
    );
  }

  // Team exists — show members with approval status
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-[var(--compass-teal)]/10 flex items-center justify-center mb-4">
          <Users className="h-6 w-6 text-[var(--compass-teal)]" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Team Authorization</h3>
        <p className="text-sm text-muted-foreground">
          {team?.name ?? 'Proposal Team'} — {members.length} member
          {members.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Member list with approval status */}
      <div className="space-y-2">
        {members.map((member) => {
          const memberApproved = approvalMap.get(member.id) != null;
          const isLeadMember = member.role === 'lead';
          const isViewerMember = member.role === 'viewer';

          return (
            <div
              key={member.id}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm font-mono text-foreground truncate">
                  {truncateAddress(member.stakeAddress)}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Approval status indicator */}
                {isLeadMember && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                    Implicit
                  </span>
                )}
                {!isLeadMember &&
                  !isViewerMember &&
                  (memberApproved ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <Check className="h-3.5 w-3.5" />
                      Approved
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Pending
                    </span>
                  ))}
                <Badge variant="outline" className={ROLE_COLORS[member.role]}>
                  {ROLE_LABELS[member.role]}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>

      {/* Approve button for the current editor */}
      {canApprove && (
        <Button
          onClick={handleApprove}
          disabled={approveMutation.isPending}
          className="w-full"
          style={{ backgroundColor: 'var(--compass-teal)', color: 'var(--primary-foreground)' }}
        >
          {approveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Recording approval...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Approve Submission
            </>
          )}
        </Button>
      )}

      {/* Status note */}
      {allApproved ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-center">
          <p className="text-sm text-emerald-400 font-medium flex items-center justify-center gap-2">
            <Check className="h-4 w-4" />
            All team members have approved
          </p>
        </div>
      ) : isLead ? (
        <p className="text-xs text-muted-foreground text-center px-4">
          {pendingCount} editor{pendingCount !== 1 ? 's' : ''} still pending. As lead, you may
          proceed without waiting, but we recommend waiting for all approvals.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground text-center px-4">
          Waiting for {pendingCount} editor{pendingCount !== 1 ? 's' : ''} to approve before
          submission can proceed.
        </p>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={onContinue} disabled={!canContinue} className="flex-1">
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
