'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, useReducedMotion } from 'framer-motion';
import { ExternalLink, CheckCircle2, ShieldCheck, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PROPOSAL_TYPE_LABELS } from '@/lib/workspace/types';
import { useFocusStore } from '@/lib/workspace/focus';
import { useProposalMonitor } from '@/hooks/useProposalMonitor';
import { VotingProgress } from './monitor/VotingProgress';
import { DraftQuickActions } from './DraftQuickActions';
import type { ProposalDraft, DraftStatus } from '@/lib/workspace/types';
import type { ProposalMonitorData } from '@/lib/workspace/monitor-types';

// ---------------------------------------------------------------------------
// Helpers
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

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

/** Count non-empty fields among title, abstract, motivation, rationale */
function completenessCount(draft: ProposalDraft): { filled: number; total: number } {
  const fields = [draft.title, draft.abstract, draft.motivation, draft.rationale];
  const filled = fields.filter((f) => f && f.trim().length > 0).length;
  return { filled, total: 4 };
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  review: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  ready: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  submitted: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  archived: 'bg-muted text-muted-foreground',
  community_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  response_revision: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  final_comment: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

const STATUS_LABELS: Record<DraftStatus, string> = {
  draft: 'Draft',
  community_review: 'Community Review',
  response_revision: 'Response & Revision',
  final_comment: 'Final Comment',
  submitted: 'Submitted',
  archived: 'Archived',
};

type ColumnType = 'drafts' | 'inReview' | 'onChain' | 'archived';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DraftCardProps {
  draft: ProposalDraft;
  index: number;
  column: ColumnType;
  /** Props to spread for keyboard focus (from useFocusableList) */
  itemProps?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DraftCard({ draft, index, column, itemProps }: DraftCardProps) {
  const router = useRouter();
  const setInputMethod = useFocusStore((s) => s.setInputMethod);
  const prefersReducedMotion = useReducedMotion();

  // Submitted drafts go to the monitoring dashboard; others to the editor
  const editorPath =
    draft.status === 'submitted'
      ? `/workspace/author/${draft.id}/monitor`
      : draft.proposalType === 'NewConstitution'
        ? `/workspace/amendment/${draft.id}`
        : `/workspace/author/${draft.id}`;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: Math.min(index, 10) * 0.05,
        duration: 0.15,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <Card
        className="h-full hover:bg-accent/50 transition-colors group/card relative"
        {...(itemProps ?? {})}
      >
        <Link
          href={editorPath}
          onClick={() => setInputMethod('pointer')}
          className="block cursor-pointer"
        >
          <CardContent className="space-y-3" style={{ padding: 'var(--workspace-card-padding)' }}>
            {/* Title + version row */}
            <div className="flex items-start justify-between gap-2">
              <h3
                className="font-medium line-clamp-2"
                style={{
                  fontSize: 'var(--workspace-font-size)',
                  lineHeight: 'var(--workspace-line-height)',
                }}
              >
                {draft.title || 'Untitled Draft'}
              </h3>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                v{draft.currentVersion}
              </span>
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {PROPOSAL_TYPE_LABELS[draft.proposalType] ?? draft.proposalType}
              </Badge>
              <Badge className={`text-xs ${STATUS_COLORS[draft.status] ?? STATUS_COLORS.draft}`}>
                {STATUS_LABELS[draft.status] ?? draft.status}
              </Badge>
            </div>

            {/* Column-specific info */}
            {column === 'drafts' && <DraftColumnInfo draft={draft} />}
            {column === 'inReview' && <InReviewColumnInfo draft={draft} />}
            {column === 'onChain' && <OnChainColumnInfo draft={draft} />}

            {/* Updated time */}
            <p className="text-xs text-muted-foreground">
              Updated {formatRelativeTime(draft.updatedAt)}
            </p>
          </CardContent>
        </Link>

        {/* Quick actions button — positioned absolutely top-right over the card */}
        <div
          className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <DraftQuickActions draft={draft} router={router} />
        </div>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Column-specific info sub-components
// ---------------------------------------------------------------------------

function DraftColumnInfo({ draft }: { draft: ProposalDraft }) {
  const { filled, total } = completenessCount(draft);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">
        Completeness: {filled}/{total}
      </span>
      <div className="flex gap-0.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              i < filled ? 'bg-emerald-500' : 'bg-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function InReviewColumnInfo({ draft }: { draft: ProposalDraft }) {
  const days = daysAgo(draft.communityReviewStartedAt);
  const { filled } = completenessCount(draft);
  const fieldsOk = filled >= 4;
  const constCheck = draft.lastConstitutionalCheck?.score ?? null;
  const constOk = constCheck === 'pass';

  return (
    <div className="flex flex-col gap-1.5">
      {days !== null && <span className="text-xs text-muted-foreground">{days}d in review</span>}
      <div className="flex items-center gap-2 flex-wrap">
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
              constOk
                ? 'text-emerald-400'
                : constCheck === 'warning'
                  ? 'text-amber-400'
                  : 'text-destructive',
            )}
          >
            <ShieldCheck className="h-3 w-3" />
            {constCheck === 'pass' ? 'Pass' : constCheck === 'warning' ? 'Warn' : 'Fail'}
          </span>
        )}
      </div>
    </div>
  );
}

const ON_CHAIN_STATUS_LABELS: Record<
  ProposalMonitorData['status'],
  { label: string; className: string }
> = {
  voting: { label: 'In Voting', className: 'bg-blue-500/15 text-blue-400' },
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

function OnChainColumnInfo({ draft }: { draft: ProposalDraft }) {
  const { data: monitor } = useProposalMonitor(draft.submittedTxHash, 0);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Monitor-enriched info when available */}
      {monitor ? (
        <>
          {/* Status badge override */}
          <div className="flex items-center gap-2">
            <Badge className={cn('text-xs', ON_CHAIN_STATUS_LABELS[monitor.status].className)}>
              {ON_CHAIN_STATUS_LABELS[monitor.status].label}
            </Badge>
            {monitor.epochsRemaining != null && monitor.status === 'voting' && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {monitor.epochsRemaining}e left
              </span>
            )}
          </div>

          {/* Compact voting progress */}
          <VotingProgress voting={monitor.voting} compact />
        </>
      ) : (
        <>
          {/* Fallback: basic info while monitor data loads */}
          {draft.submittedAt && (
            <span className="text-xs text-muted-foreground">
              Submitted {formatRelativeTime(draft.submittedAt)}
            </span>
          )}
          {draft.submittedTxHash && (
            <a
              href={`https://cardanoscan.io/transaction/${draft.submittedTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {truncateHash(draft.submittedTxHash)}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </>
      )}
    </div>
  );
}
