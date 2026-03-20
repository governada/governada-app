'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ShieldCheck, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PROPOSAL_TYPE_LABELS } from '@/lib/workspace/types';
import { useFocusStore } from '@/lib/workspace/focus';
import { useProposalMonitor } from '@/hooks/useProposalMonitor';
import { DraftQuickActions } from './DraftQuickActions';
import type { ProposalDraft } from '@/lib/workspace/types';
import type { ProposalMonitorData } from '@/lib/workspace/monitor-types';

// ---------------------------------------------------------------------------
// Helpers (shared with DraftCard)
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000));
}

function completenessCount(draft: ProposalDraft): { filled: number; total: number } {
  const fields = [draft.title, draft.abstract, draft.motivation, draft.rationale];
  const filled = fields.filter((f) => f && f.trim().length > 0).length;
  return { filled, total: 4 };
}

const ON_CHAIN_STATUS_LABELS: Record<
  ProposalMonitorData['status'],
  { label: string; className: string }
> = {
  voting: { label: 'Voting', className: 'bg-blue-500/15 text-blue-400' },
  ratified: {
    label: 'Ratified',
    className: 'bg-[var(--compass-teal)]/15 text-[var(--compass-teal)]',
  },
  enacted: {
    label: 'Enacted',
    className: 'bg-[var(--compass-teal)]/15 text-[var(--compass-teal)]',
  },
  expired: { label: 'Expired', className: 'bg-muted text-muted-foreground' },
  dropped: { label: 'Dropped', className: 'bg-destructive/15 text-destructive' },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ColumnType = 'drafts' | 'inReview' | 'onChain' | 'archived';

interface DraftTableRowProps {
  draft: ProposalDraft;
  column: ColumnType;
  itemProps?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DraftTableRow({ draft, column, itemProps }: DraftTableRowProps) {
  const router = useRouter();
  const setInputMethod = useFocusStore((s) => s.setInputMethod);

  const editorPath =
    draft.status === 'submitted'
      ? `/workspace/author/${draft.id}/monitor`
      : draft.proposalType === 'NewConstitution'
        ? `/workspace/amendment/${draft.id}`
        : `/workspace/author/${draft.id}`;

  const href =
    column === 'onChain' && draft.status === 'submitted'
      ? `/workspace/author/${draft.id}/debrief`
      : editorPath;

  return (
    <div
      className="group/row relative border-b border-border/50 last:border-b-0 hover:bg-accent/40 transition-colors"
      {...(itemProps ?? {})}
    >
      <Link
        href={href}
        onClick={() => setInputMethod('pointer')}
        className="flex items-center gap-4 px-3 py-2.5 min-h-[44px]"
      >
        {/* Title — takes remaining space */}
        <span
          className="flex-1 min-w-0 font-medium text-sm truncate"
          style={{ viewTransitionName: `draft-title-${draft.id}` }}
        >
          {draft.title || 'Untitled proposal'}
        </span>

        {/* Metadata — right-aligned, fixed-width slots */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Type badge */}
          <Badge variant="outline" className="text-xs hidden sm:inline-flex">
            {PROPOSAL_TYPE_LABELS[draft.proposalType] ?? draft.proposalType}
          </Badge>

          {/* Column-specific metadata */}
          {column === 'drafts' && <DraftMeta draft={draft} />}
          {column === 'inReview' && <InReviewMeta draft={draft} />}
          {column === 'onChain' && <OnChainMeta draft={draft} />}

          {/* Version */}
          <span className="text-xs text-muted-foreground tabular-nums w-6 text-right">
            v{draft.currentVersion}
          </span>

          {/* Updated time */}
          <span className="text-xs text-muted-foreground w-16 text-right hidden md:block">
            {formatRelativeTime(draft.updatedAt)}
          </span>
        </div>
      </Link>

      {/* Quick actions — hover only on desktop, always on mobile */}
      <div
        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DraftQuickActions draft={draft} router={router} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline metadata sub-components
// ---------------------------------------------------------------------------

function DraftMeta({ draft }: { draft: ProposalDraft }) {
  const { filled, total } = completenessCount(draft);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'inline-block h-1.5 w-1.5 rounded-full',
              i < filled ? 'bg-emerald-500' : 'bg-muted-foreground/30',
            )}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {filled}/{total}
      </span>
    </div>
  );
}

function InReviewMeta({ draft }: { draft: ProposalDraft }) {
  const { filled } = completenessCount(draft);
  const fieldsOk = filled >= 4;
  const constCheck = draft.lastConstitutionalCheck?.score ?? null;

  const days = daysSince(draft.communityReviewStartedAt);

  return (
    <div className="flex items-center gap-2.5">
      {days !== null && <span className="text-xs text-muted-foreground tabular-nums">{days}d</span>}
      <span
        className={cn(
          'flex items-center gap-0.5 text-xs',
          fieldsOk ? 'text-emerald-400' : 'text-muted-foreground',
        )}
      >
        {fieldsOk ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        {filled}/4
      </span>
      {constCheck && (
        <span
          className={cn(
            'flex items-center gap-0.5 text-xs',
            constCheck === 'pass'
              ? 'text-emerald-400'
              : constCheck === 'warning'
                ? 'text-amber-400'
                : 'text-destructive',
          )}
        >
          <ShieldCheck className="h-3 w-3" />
        </span>
      )}
    </div>
  );
}

function OnChainMeta({ draft }: { draft: ProposalDraft }) {
  const { data: monitor } = useProposalMonitor(draft.submittedTxHash, 0);

  if (!monitor) return null;

  return (
    <div className="flex items-center gap-2">
      <Badge className={cn('text-xs', ON_CHAIN_STATUS_LABELS[monitor.status].className)}>
        {ON_CHAIN_STATUS_LABELS[monitor.status].label}
      </Badge>
      {monitor.epochsRemaining != null && monitor.status === 'voting' && (
        <span className="flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums">
          <Clock className="h-3 w-3" />
          {monitor.epochsRemaining}e
        </span>
      )}
    </div>
  );
}
