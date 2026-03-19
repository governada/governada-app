'use client';

/**
 * TeamSignOff — Step 3 of the submission ceremony.
 *
 * INFORMATIONAL ONLY — displays team composition and roles but does not
 * block submission. The lead can always proceed. A blocking approval gate
 * will be added in Phase 4 when team collaboration is more mature.
 */

import { Users, UserCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTeam } from '@/hooks/useTeam';
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
  const { data, isLoading } = useTeam(draftId);

  const team = data?.team ?? null;
  const members = data?.members ?? [];

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

  // Team exists — show members
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

      {/* Member list */}
      <div className="space-y-2">
        {members.map((member) => (
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
            <Badge variant="outline" className={ROLE_COLORS[member.role]}>
              {ROLE_LABELS[member.role]}
            </Badge>
          </div>
        ))}
      </div>

      {/* Informational note */}
      <p className="text-xs text-muted-foreground text-center px-4">
        Team sign-off is informational. The lead can proceed with submission.
      </p>

      {/* Navigation */}
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
