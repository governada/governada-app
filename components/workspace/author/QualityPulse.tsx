'use client';

/**
 * QualityPulse — Always-visible quality signal for the author studio.
 *
 * JTBD: At a glance, know the health of your proposal without clicking any tab.
 *
 * Displays a compact horizontal strip showing:
 * 1. Per-section quality indicators (title, abstract, motivation, rationale)
 * 2. Constitutional check status badge
 * 3. Community feedback count (when in review)
 *
 * This component renders ABOVE the panel tabs — it's always visible regardless
 * of which tab is active. The full ReadinessPanel in the tab provides detail.
 */

import { useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Circle,
  Shield,
  MessageSquareText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConstitutionalCheckResult } from '@/lib/workspace/types';
import type { SectionAnalysisOutput } from '@/lib/ai/skills/section-analysis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QualityPulseProps {
  /** Draft fields for completeness check */
  fields: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
  /** Section analysis results (from useSectionAnalysis or similar) */
  sectionResults?: Record<string, SectionAnalysisOutput | null>;
  /** Section analysis loading state */
  sectionLoading?: Record<string, boolean>;
  /** Constitutional check result stored on draft */
  constitutionalCheck: ConstitutionalCheckResult | null;
  /** Whether constitutional check is currently running */
  constitutionalLoading?: boolean;
  /** Community feedback theme count (0 if no feedback yet) */
  feedbackThemeCount?: number;
  /** Total reviewer count */
  reviewerCount?: number;
  /** Click handler for constitutional badge — could open readiness tab */
  onConstitutionalClick?: () => void;
  /** Click handler for feedback section — could open readiness tab */
  onFeedbackClick?: () => void;
}

// ---------------------------------------------------------------------------
// Section indicator
// ---------------------------------------------------------------------------

type SectionHealth = 'empty' | 'needs_work' | 'adequate' | 'strong' | 'loading';

function deriveSectionHealth(
  fieldValue: string,
  analysisResult: SectionAnalysisOutput | null | undefined,
  isLoading: boolean,
): SectionHealth {
  if (!fieldValue || fieldValue.trim().length === 0) return 'empty';
  if (isLoading) return 'loading';
  if (!analysisResult) {
    // Content exists but not yet analyzed — show as adequate (neutral)
    return fieldValue.trim().length > 20 ? 'adequate' : 'needs_work';
  }
  return analysisResult.overallQuality;
}

function SectionIndicator({ label, health }: { label: string; health: SectionHealth }) {
  const icon =
    health === 'strong' ? (
      <CheckCircle2 className="h-3 w-3 text-[var(--compass-teal)]" />
    ) : health === 'adequate' ? (
      <CheckCircle2 className="h-3 w-3 text-muted-foreground/50" />
    ) : health === 'needs_work' ? (
      <AlertTriangle className="h-3 w-3 text-[var(--wayfinder-amber)]" />
    ) : health === 'loading' ? (
      <Circle className="h-3 w-3 text-muted-foreground/30 animate-pulse" />
    ) : (
      <XCircle className="h-3 w-3 text-muted-foreground/30" />
    );

  return (
    <div className="flex items-center gap-1" title={`${label}: ${health}`}>
      {icon}
      <span
        className={cn(
          'text-[10px]',
          health === 'strong'
            ? 'text-[var(--compass-teal)]'
            : health === 'needs_work'
              ? 'text-[var(--wayfinder-amber)]'
              : health === 'empty'
                ? 'text-muted-foreground/30'
                : 'text-muted-foreground/60',
        )}
      >
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Constitutional badge
// ---------------------------------------------------------------------------

function ConstitutionalBadge({
  result,
  isLoading,
  onClick,
}: {
  result: ConstitutionalCheckResult | null;
  isLoading?: boolean;
  onClick?: () => void;
}) {
  if (isLoading) {
    return (
      <button
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-muted/50 text-muted-foreground animate-pulse cursor-default"
        disabled
      >
        <Shield className="h-3 w-3" />
        Checking...
      </button>
    );
  }

  if (!result) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-muted/30 text-muted-foreground/50 hover:bg-muted/50 transition-colors cursor-pointer"
        title="Constitutional check not yet run"
      >
        <Shield className="h-3 w-3" />
        Not checked
      </button>
    );
  }

  const score = result.score;
  const flagCount = result.flags?.length ?? 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer',
        score === 'pass'
          ? 'bg-[color-mix(in_oklch,var(--compass-teal),transparent_90%)] text-[var(--compass-teal)] hover:bg-[color-mix(in_oklch,var(--compass-teal),transparent_80%)]'
          : score === 'warning'
            ? 'bg-[color-mix(in_oklch,var(--wayfinder-amber),transparent_90%)] text-[var(--wayfinder-amber)] hover:bg-[color-mix(in_oklch,var(--wayfinder-amber),transparent_80%)]'
            : 'bg-destructive/10 text-destructive hover:bg-destructive/20',
      )}
      title={
        score === 'pass'
          ? 'Constitutional check passed'
          : `${flagCount} constitutional flag${flagCount !== 1 ? 's' : ''}`
      }
    >
      <Shield className="h-3 w-3" />
      {score === 'pass'
        ? 'Pass'
        : score === 'warning'
          ? `${flagCount} flag${flagCount !== 1 ? 's' : ''}`
          : 'Fail'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function QualityPulse({
  fields,
  sectionResults,
  sectionLoading,
  constitutionalCheck,
  constitutionalLoading,
  feedbackThemeCount = 0,
  reviewerCount = 0,
  onConstitutionalClick,
  onFeedbackClick,
}: QualityPulseProps) {
  const sections = useMemo(
    () => [
      {
        key: 'title',
        label: 'Title',
        health: deriveSectionHealth(
          fields.title,
          sectionResults?.title,
          sectionLoading?.title ?? false,
        ),
      },
      {
        key: 'abstract',
        label: 'Abstract',
        health: deriveSectionHealth(
          fields.abstract,
          sectionResults?.abstract,
          sectionLoading?.abstract ?? false,
        ),
      },
      {
        key: 'motivation',
        label: 'Motivation',
        health: deriveSectionHealth(
          fields.motivation,
          sectionResults?.motivation,
          sectionLoading?.motivation ?? false,
        ),
      },
      {
        key: 'rationale',
        label: 'Rationale',
        health: deriveSectionHealth(
          fields.rationale,
          sectionResults?.rationale,
          sectionLoading?.rationale ?? false,
        ),
      },
    ],
    [fields, sectionResults, sectionLoading],
  );

  const hasFeedback = feedbackThemeCount > 0 || reviewerCount > 0;

  return (
    <div className="flex items-center gap-[var(--space-sm)] px-[var(--space-sm)] py-[var(--space-xs)] border-b border-border bg-background/80 shrink-0 overflow-x-auto">
      {/* Section indicators */}
      <div className="flex items-center gap-2">
        {sections.map((s) => (
          <SectionIndicator key={s.key} label={s.label} health={s.health} />
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-3.5 bg-border shrink-0" />

      {/* Constitutional check */}
      <ConstitutionalBadge
        result={constitutionalCheck}
        isLoading={constitutionalLoading}
        onClick={onConstitutionalClick}
      />

      {/* Community feedback (only show when relevant) */}
      {hasFeedback && (
        <>
          <div className="w-px h-3.5 bg-border shrink-0" />
          <button
            onClick={onFeedbackClick}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
            title={`${reviewerCount} reviewer${reviewerCount !== 1 ? 's' : ''}, ${feedbackThemeCount} theme${feedbackThemeCount !== 1 ? 's' : ''}`}
          >
            <MessageSquareText className="h-3 w-3" />
            {feedbackThemeCount > 0
              ? `${feedbackThemeCount} theme${feedbackThemeCount !== 1 ? 's' : ''}`
              : `${reviewerCount} review${reviewerCount !== 1 ? 's' : ''}`}
          </button>
        </>
      )}
    </div>
  );
}
