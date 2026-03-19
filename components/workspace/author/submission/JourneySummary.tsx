'use client';

/**
 * Journey Summary Panel — shows the proposal's path to submission.
 *
 * Displays the approval chain at a glance: confidence score, timeline
 * milestones, review status, constitutional check, and team members.
 * Used as the left panel in the submission ceremony page.
 */

import { Check, X, Clock, Users, Shield, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ProposalDraft } from '@/lib/workspace/types';
import type { ConfidenceResult } from '@/lib/workspace/confidence';
import { confidenceLevelColor, confidenceLevelBg } from '@/lib/workspace/confidence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JourneySummaryProps {
  draft: ProposalDraft;
  reviews: {
    total: number;
    nonStale: number;
    averageScore: number | null;
    allAddressed: boolean;
  };
  confidence: ConfidenceResult;
  versionCount: number;
  teamMembers?: { stakeAddress: string; role: string }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function has48hInReview(draft: ProposalDraft): boolean {
  if (!draft.communityReviewStartedAt) return false;
  const start = new Date(draft.communityReviewStartedAt).getTime();
  const now = Date.now();
  return now - start >= 48 * 60 * 60 * 1000;
}

function constitutionalLabel(check: ProposalDraft['lastConstitutionalCheck']): {
  label: string;
  passed: boolean | null;
} {
  if (!check) return { label: 'Not run', passed: null };
  switch (check.score) {
    case 'pass':
      return { label: 'Pass', passed: true };
    case 'warning':
      return { label: 'Warning', passed: null };
    case 'fail':
      return { label: 'Fail', passed: false };
    default:
      return { label: 'Unknown', passed: null };
  }
}

// ---------------------------------------------------------------------------
// Checklist item
// ---------------------------------------------------------------------------

function ChecklistItem({
  label,
  passed,
  detail,
}: {
  label: string;
  passed: boolean | null;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <div className="mt-0.5 shrink-0">
        {passed === true && <Check className="h-3.5 w-3.5 text-emerald-400" />}
        {passed === false && <X className="h-3.5 w-3.5 text-destructive" />}
        {passed === null && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className="min-w-0">
        <span className="text-foreground">{label}</span>
        {detail && <span className="ml-1 text-muted-foreground">{detail}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JourneySummary({
  draft,
  reviews,
  confidence,
  versionCount,
  teamMembers,
}: JourneySummaryProps) {
  const constCheck = constitutionalLabel(draft.lastConstitutionalCheck);
  const reviewed48h = has48hInReview(draft);

  return (
    <div className="space-y-6">
      {/* ── Confidence Score ── */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Community Confidence</span>
          <Badge variant="outline" className={confidenceLevelColor(confidence.level)}>
            {confidence.level.charAt(0).toUpperCase() + confidence.level.slice(1)}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-2xl font-display font-bold ${confidenceLevelColor(confidence.level)}`}
          >
            {confidence.score}%
          </span>
          <div className="flex-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${confidenceLevelBg(confidence.level)}`}
                style={{ width: `${confidence.score}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Journey Checklist ── */}
      <div className="rounded-lg border-l-2 border-l-[var(--compass-teal)] border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Journey</span>
        </div>

        <div className="space-y-2.5">
          <ChecklistItem
            label="Draft created"
            passed={true}
            detail={formatRelativeTime(draft.createdAt)}
          />

          <ChecklistItem
            label={`${versionCount} version${versionCount !== 1 ? 's' : ''}`}
            passed={versionCount >= 1}
            detail={versionCount > 1 ? '(iterated)' : undefined}
          />

          <ChecklistItem
            label={`${reviews.nonStale} review${reviews.nonStale !== 1 ? 's' : ''} received`}
            passed={reviews.nonStale > 0}
            detail={
              reviews.averageScore !== null ? `avg ${reviews.averageScore.toFixed(1)}/5` : undefined
            }
          />

          <ChecklistItem
            label="All reviews addressed"
            passed={reviews.total > 0 ? reviews.allAddressed : null}
            detail={reviews.total === 0 ? 'No reviews yet' : undefined}
          />

          <ChecklistItem
            label={`Constitutional check: ${constCheck.label}`}
            passed={constCheck.passed}
          />

          <ChecklistItem
            label="48h in community review"
            passed={reviewed48h}
            detail={!reviewed48h && draft.communityReviewStartedAt ? 'In progress' : undefined}
          />
        </div>
      </div>

      {/* ── Team Section ── */}
      {teamMembers && teamMembers.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Team</span>
          </div>
          <div className="space-y-2">
            {teamMembers.map((m) => (
              <div key={m.stakeAddress} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-mono text-xs truncate max-w-[160px]">
                  {m.stakeAddress.slice(0, 12)}...{m.stakeAddress.slice(-6)}
                </span>
                <Badge variant="outline" className="text-xs capitalize">
                  {m.role}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Confidence Factors ── */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Score Breakdown</span>
        </div>
        {confidence.factors.map((f) => (
          <div key={f.name} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{f.name}</span>
            <span className="text-foreground">{f.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
