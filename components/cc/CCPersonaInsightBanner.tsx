'use client';

import { useMemo } from 'react';
import { Shield, Users, Server, Eye, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSegment, type UserSegment } from '@/components/providers/SegmentProvider';
import type {
  CCHealthSummaryResponse,
  CCCommitteeStats,
  CommitteeMemberQuickView,
} from '@/hooks/queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CCPersonaInsightBannerProps {
  health: CCHealthSummaryResponse;
  stats: CCCommitteeStats;
  members: CommitteeMemberQuickView[];
}

// ---------------------------------------------------------------------------
// Persona configs
// ---------------------------------------------------------------------------

const PERSONA_BORDER: Record<UserSegment, string> = {
  anonymous: 'border-l-muted-foreground/50',
  citizen: 'border-l-blue-500',
  drep: 'border-l-violet-500',
  spo: 'border-l-amber-500',
  cc: 'border-l-emerald-500',
};

const PERSONA_ICON: Record<UserSegment, typeof Shield> = {
  anonymous: Eye,
  citizen: Shield,
  drep: Users,
  spo: Server,
  cc: Scale,
};

// ---------------------------------------------------------------------------
// Insight generators
// ---------------------------------------------------------------------------

function getIndependenceLabel(avgFidelity: number | null): string {
  if (avgFidelity == null) return 'unknown';
  if (avgFidelity >= 75) return 'high';
  if (avgFidelity >= 50) return 'moderate';
  return 'low';
}

function buildCitizenInsight(health: CCHealthSummaryResponse, stats: CCCommitteeStats): string {
  const reviewed = stats.totalProposalsReviewed;
  const total = health.totalMembers;
  const independence = getIndependenceLabel(health.avgFidelity);
  if (reviewed > 0) {
    return `The Constitutional Committee reviewed ${reviewed} proposal${reviewed !== 1 ? 's' : ''} with ${total} active member${total !== 1 ? 's' : ''}. Their independence score is ${independence}.`;
  }
  return `The Constitutional Committee has ${total} member${total !== 1 ? 's' : ''} with an independence score rated ${independence}. They verify whether proposals follow Cardano's constitution.`;
}

function buildDRepInsight(health: CCHealthSummaryResponse, stats: CCCommitteeStats): string {
  const avgFidelity = health.avgFidelity != null ? Math.round(health.avgFidelity) : null;
  const reviewed = stats.totalProposalsReviewed;
  const tensionAreas: string[] = [];
  if (health.tensionCount > 0) tensionAreas.push('constitutional interpretation');
  if (reviewed > 5) tensionAreas.push('treasury oversight');
  const tensionStr =
    tensionAreas.length > 0 ? ` Key tension areas: ${tensionAreas.join(', ')}.` : '';
  if (avgFidelity != null) {
    return `CC average fidelity score: ${avgFidelity}%. ${health.tensionCount} tension${health.tensionCount !== 1 ? 's' : ''} detected in recent votes.${tensionStr}`;
  }
  return `The CC is currently ${health.status}. ${health.tensionCount} tension${health.tensionCount !== 1 ? 's' : ''} in recent votes.${tensionStr}`;
}

function buildSPOInsight(health: CCHealthSummaryResponse, stats: CCCommitteeStats): string {
  const status = health.status;
  const reviewed = stats.totalProposalsReviewed;
  const statusLabel =
    status === 'healthy'
      ? 'stable'
      : status === 'attention'
        ? 'under scrutiny'
        : 'in critical state';
  return `The CC is ${statusLabel} with ${reviewed} proposal${reviewed !== 1 ? 's' : ''} reviewed. CC decisions on parameter changes and hard forks directly affect pool operations.`;
}

function buildAnonymousInsight(health: CCHealthSummaryResponse): string {
  return `The Constitutional Committee checks whether proposals follow Cardano's constitution. Currently ${health.activeMembers} of ${health.totalMembers} members are active.`;
}

function buildCCMemberInsight(members: CommitteeMemberQuickView[]): string {
  const ranked = members
    .filter((m) => m.rank != null)
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const total = ranked.length;
  if (total === 0) {
    return 'Your fidelity ranking is not yet available. Vote on more proposals to build your constitutional track record.';
  }
  return `There are ${total} ranked committee members. Review your fidelity ranking in the member directory below.`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CCPersonaInsightBanner({ health, stats, members }: CCPersonaInsightBannerProps) {
  const { segment } = useSegment();

  const insight = useMemo(() => {
    switch (segment) {
      case 'citizen':
        return buildCitizenInsight(health, stats);
      case 'drep':
        return buildDRepInsight(health, stats);
      case 'spo':
        return buildSPOInsight(health, stats);
      case 'cc':
        return buildCCMemberInsight(members);
      case 'anonymous':
      default:
        return buildAnonymousInsight(health);
    }
  }, [segment, health, stats, members]);

  const Icon = PERSONA_ICON[segment] ?? Eye;
  const borderClass = PERSONA_BORDER[segment] ?? PERSONA_BORDER.anonymous;

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 border-l-4 bg-muted/20 px-4 py-3',
        borderClass,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
      </div>
    </div>
  );
}
