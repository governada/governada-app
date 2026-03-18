'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { PROPOSAL_TYPE_LABELS } from '@/lib/workspace/types';
import type { ProposalDraft, ProposalType } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamDraft extends ProposalDraft {
  memberRole?: string;
}

interface TeamProposalsSectionProps {
  drafts: TeamDraft[];
  isLoading: boolean;
}

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

function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

const ROLE_LABELS: Record<string, string> = {
  lead: 'Lead',
  editor: 'Editor',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<string, string> = {
  lead: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  editor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  viewer: 'bg-muted text-muted-foreground',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TeamProposalsSection({ drafts, isLoading }: TeamProposalsSectionProps) {
  const [expanded, setExpanded] = useState(drafts.length > 0);

  // Don't render if loading and no previous data, or if there are no team drafts
  if (isLoading && drafts.length === 0) return null;
  if (!isLoading && drafts.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <Button
        variant="ghost"
        className="flex items-center gap-2 px-1 h-auto py-1 hover:bg-transparent"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Team Proposals</span>
        <Badge variant="secondary" className="text-xs tabular-nums">
          {drafts.length}
        </Badge>
      </Button>

      {/* Content */}
      {expanded && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 'var(--workspace-gap)' }}>
          {drafts.map((draft) => (
            <TeamDraftCard key={draft.id} draft={draft} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team Draft Card
// ---------------------------------------------------------------------------

function TeamDraftCard({ draft }: { draft: TeamDraft }) {
  const role = draft.memberRole ?? 'viewer';
  const canEdit = role === 'lead' || role === 'editor';
  const editorPath = canEdit
    ? draft.proposalType === 'NewConstitution'
      ? `/workspace/amendment/${draft.id}`
      : `/workspace/author/${draft.id}`
    : `/workspace/author/${draft.id}`;

  return (
    <Card className="h-full hover:bg-accent/50 transition-colors">
      <Link href={editorPath} className="block cursor-pointer">
        <CardContent className="space-y-3" style={{ padding: 'var(--workspace-card-padding)' }}>
          {/* Title */}
          <h3
            className="font-medium line-clamp-2"
            style={{
              fontSize: 'var(--workspace-font-size)',
              lineHeight: 'var(--workspace-line-height)',
            }}
          >
            {draft.title || 'Untitled Draft'}
          </h3>

          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {PROPOSAL_TYPE_LABELS[draft.proposalType as ProposalType] ?? draft.proposalType}
            </Badge>
            <Badge className={`text-xs ${ROLE_COLORS[role] ?? ROLE_COLORS.viewer}`}>
              {ROLE_LABELS[role] ?? role}
            </Badge>
          </div>

          {/* Owner + updated time */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground font-mono">
              {truncateAddress(draft.ownerStakeAddress)}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(draft.updatedAt)}
            </span>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
