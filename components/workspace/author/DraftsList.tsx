'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText } from 'lucide-react';
import { PROPOSAL_TYPE_LABELS } from '@/lib/workspace/types';
import type { ProposalDraft } from '@/lib/workspace/types';

interface DraftsListProps {
  drafts: ProposalDraft[];
  isLoading: boolean;
}

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

export function DraftsList({ drafts, isLoading }: DraftsListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground font-medium">No drafts yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Create your first proposal to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {drafts.map((draft) => (
        <Link key={draft.id} href={`/workspace/author/${draft.id}`}>
          <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-sm line-clamp-2 leading-snug">
                  {draft.title || 'Untitled Draft'}
                </h3>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  v{draft.currentVersion}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {PROPOSAL_TYPE_LABELS[draft.proposalType] ?? draft.proposalType}
                </Badge>
                <Badge className={`text-xs ${STATUS_COLORS[draft.status] ?? STATUS_COLORS.draft}`}>
                  {draft.status}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground">
                Updated {formatRelativeTime(draft.updatedAt)}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
