'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { X, ArrowRight, Clock, FileText, Vote } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useReviewQueue } from '@/hooks/useReviewQueue';
import { useDrafts } from '@/hooks/useDrafts';
import { cn } from '@/lib/utils';
import posthog from 'posthog-js';

interface WorkspaceCardsProps {
  onClose: () => void;
}

const MAX_ITEMS = 3;

export function WorkspaceCards({ onClose }: WorkspaceCardsProps) {
  const { stakeAddress, drepId } = useSegment();
  const voterId = drepId ?? stakeAddress;
  const { data: reviewData } = useReviewQueue(voterId);
  const { data: draftsData } = useDrafts(stakeAddress);

  const reviewItems = useMemo(() => {
    const items = reviewData?.items ?? [];
    // Unvoted items sorted by urgency (fewer epochs = more urgent)
    return items
      .filter((i) => !i.existingVote)
      .sort((a, b) => (a.epochsRemaining ?? Infinity) - (b.epochsRemaining ?? Infinity))
      .slice(0, MAX_ITEMS);
  }, [reviewData]);

  const draftItems = useMemo(() => {
    const drafts = draftsData?.drafts ?? [];
    return drafts
      .filter((d) => d.status !== 'archived')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, MAX_ITEMS);
  }, [draftsData]);

  const hasReviews = reviewItems.length > 0;
  const hasDrafts = draftItems.length > 0;
  const totalReviews = reviewData?.items?.filter((i) => !i.existingVote).length ?? 0;
  const totalDrafts = draftsData?.drafts?.filter((d) => d.status !== 'archived').length ?? 0;

  const handleCardClick = (destination: string) => {
    posthog.capture('globe_workspace_card_clicked', { destination });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[28] w-[340px] max-h-[80vh] pointer-events-auto"
    >
      <div className="rounded-xl border border-border/40 bg-background/80 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
          <h3 className="text-sm font-semibold text-foreground">Your Workspace</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {/* Review Queue Section */}
          {hasReviews && (
            <Section
              icon={<Vote className="h-3.5 w-3.5" />}
              title="Review Queue"
              count={totalReviews}
              href="/workspace/review"
              onNavigate={handleCardClick}
            >
              {reviewItems.map((item) => (
                <ReviewItemRow
                  key={`${item.txHash}-${item.proposalIndex}`}
                  title={item.title || 'Untitled Proposal'}
                  epochsRemaining={item.epochsRemaining}
                  isUrgent={item.isUrgent}
                  href={`/workspace/review?proposal=${encodeURIComponent(item.txHash)}:${item.proposalIndex}`}
                  onNavigate={handleCardClick}
                />
              ))}
              {totalReviews > MAX_ITEMS && (
                <p className="text-xs text-muted-foreground/60 pl-2">
                  + {totalReviews - MAX_ITEMS} more
                </p>
              )}
            </Section>
          )}

          {/* Drafts Section */}
          {hasDrafts && (
            <Section
              icon={<FileText className="h-3.5 w-3.5" />}
              title="Your Drafts"
              count={totalDrafts}
              href="/workspace/author"
              onNavigate={handleCardClick}
            >
              {draftItems.map((draft) => (
                <DraftItemRow
                  key={draft.id}
                  title={draft.title || 'Untitled Draft'}
                  status={draft.status}
                  href={`/workspace/author/${draft.id}`}
                  onNavigate={handleCardClick}
                />
              ))}
              {totalDrafts > MAX_ITEMS && (
                <p className="text-xs text-muted-foreground/60 pl-2">
                  + {totalDrafts - MAX_ITEMS} more
                </p>
              )}
            </Section>
          )}

          {/* Empty state */}
          {!hasReviews && !hasDrafts && (
            <div className="text-center py-6 space-y-2">
              <p className="text-sm text-muted-foreground">No pending workspace items</p>
              <p className="text-xs text-muted-foreground/60">
                Start a draft or check the review queue
              </p>
            </div>
          )}

          {/* Enter Workspace CTA */}
          <Link
            href="/workspace"
            onClick={() => handleCardClick('/workspace')}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[var(--compass-teal)]/10 text-[var(--compass-teal)] text-sm font-medium hover:bg-[var(--compass-teal)]/20 transition-colors"
          >
            Enter Workspace
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({
  icon,
  title,
  count,
  href,
  onNavigate,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  href: string;
  onNavigate: (dest: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/30 bg-muted/20 overflow-hidden">
      <Link
        href={href}
        onClick={() => onNavigate(href)}
        className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-foreground/80">
          {icon}
          {title}
          <span className="text-muted-foreground/60 tabular-nums">({count})</span>
        </span>
        <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
      </Link>
      <div className="border-t border-border/20 divide-y divide-border/10">{children}</div>
    </div>
  );
}

function ReviewItemRow({
  title,
  epochsRemaining,
  isUrgent,
  href,
  onNavigate,
}: {
  title: string;
  epochsRemaining: number | null;
  isUrgent: boolean;
  href: string;
  onNavigate: (dest: string) => void;
}) {
  return (
    <Link
      href={href}
      onClick={() => onNavigate(href)}
      className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors group"
    >
      <span className="text-xs text-foreground/70 truncate max-w-[200px] group-hover:text-foreground">
        {title}
      </span>
      {epochsRemaining != null && (
        <span
          className={cn(
            'flex items-center gap-1 text-xs tabular-nums shrink-0 ml-2',
            isUrgent ? 'text-red-400' : 'text-muted-foreground/60',
          )}
        >
          <Clock className="h-3 w-3" />
          {epochsRemaining}d
        </span>
      )}
    </Link>
  );
}

function DraftItemRow({
  title,
  status,
  href,
  onNavigate,
}: {
  title: string;
  status: string;
  href: string;
  onNavigate: (dest: string) => void;
}) {
  const statusLabel =
    status === 'draft'
      ? 'Draft'
      : status === 'submitted'
        ? 'On-Chain'
        : status === 'archived'
          ? 'Archived'
          : 'In Review';

  const statusColor =
    status === 'draft'
      ? 'text-muted-foreground/60'
      : status === 'submitted'
        ? 'text-[var(--compass-teal)]'
        : 'text-amber-400';

  return (
    <Link
      href={href}
      onClick={() => onNavigate(href)}
      className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors group"
    >
      <span className="text-xs text-foreground/70 truncate max-w-[200px] group-hover:text-foreground">
        {title}
      </span>
      <span className={cn('text-xs shrink-0 ml-2', statusColor)}>{statusLabel}</span>
    </Link>
  );
}
