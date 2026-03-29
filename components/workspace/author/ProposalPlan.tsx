'use client';

/**
 * ProposalPlan — multi-section review of a generated Proposal Plan.
 *
 * Shown after ScaffoldForm + plan generation completes, before the author
 * enters the Tiptap editor. Displays: draft preview, constitutional
 * assessment, risk register, similar proposals, and recommended improvements.
 */

import { useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Shield,
  AlertTriangle,
  FileText,
  Lightbulb,
  History,
  CheckCircle2,
  XCircle,
  Info,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { posthog } from '@/lib/posthog';
import type { ProposalPlanOutput } from '@/lib/ai/skills/proposal-plan-generator';

interface ProposalPlanProps {
  plan: ProposalPlanOutput;
  onAccept: () => void;
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

function PlanSection({
  title,
  icon: Icon,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/40 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors cursor-pointer"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-foreground flex-1">{title}</span>
        {badge}
      </button>
      {open && <div className="px-3 pb-3 pt-1 border-t border-border/20">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score badge
// ---------------------------------------------------------------------------

const SCORE_STYLES = {
  pass: { label: 'Pass', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  warning: { label: 'Warning', color: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
  fail: { label: 'Fail', color: 'text-red-400 bg-red-400/10 border-red-400/30' },
} as const;

function ScoreBadge({ score }: { score: 'pass' | 'warning' | 'fail' }) {
  const style = SCORE_STYLES[score];
  return (
    <span className={cn('px-1.5 py-0.5 text-[10px] font-medium rounded border', style.color)}>
      {style.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------

const SEVERITY_ICON = {
  info: Info,
  warning: AlertTriangle,
  critical: XCircle,
  low: Info,
  medium: AlertTriangle,
  high: XCircle,
} as const;

const SEVERITY_COLOR = {
  info: 'text-blue-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
  low: 'text-emerald-400',
  medium: 'text-amber-400',
  high: 'text-red-400',
} as const;

// ---------------------------------------------------------------------------
// ProposalPlan component
// ---------------------------------------------------------------------------

export function ProposalPlan({ plan, onAccept }: ProposalPlanProps) {
  const handleAccept = useCallback(() => {
    posthog.capture('proposal_plan_accepted');
    onAccept();
  }, [onAccept]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Your Proposal Plan</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Review the analysis below, then enter the editor to refine your draft.
          </p>
        </div>
      </div>

      {/* Draft preview */}
      <PlanSection title="Generated Draft" icon={FileText} defaultOpen>
        <div className="space-y-3">
          <div>
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Title
            </div>
            <p className="text-xs text-foreground">{plan.draft.title || 'No title generated'}</p>
          </div>
          <div>
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Abstract
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed">
              {plan.draft.abstract || 'No abstract generated'}
            </p>
          </div>
          <div>
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Motivation
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed line-clamp-4">
              {plan.draft.motivation || 'No motivation generated'}
            </p>
          </div>
          <div>
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Rationale
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed line-clamp-4">
              {plan.draft.rationale || 'No rationale generated'}
            </p>
          </div>
        </div>
      </PlanSection>

      {/* Constitutional Assessment */}
      <PlanSection
        title="Constitutional Assessment"
        icon={Shield}
        defaultOpen={plan.constitutionalAssessment.score !== 'pass'}
        badge={<ScoreBadge score={plan.constitutionalAssessment.score} />}
      >
        <div className="space-y-2">
          <p className="text-xs text-foreground/80">{plan.constitutionalAssessment.summary}</p>
          {plan.constitutionalAssessment.flags.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {plan.constitutionalAssessment.flags.map((flag, i) => {
                const Icon = SEVERITY_ICON[flag.severity];
                return (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Icon
                      className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', SEVERITY_COLOR[flag.severity])}
                    />
                    <div>
                      <span className="font-medium text-foreground">{flag.article}</span>
                      <span className="text-foreground/70"> — {flag.concern}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {plan.constitutionalAssessment.flags.length === 0 && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              No constitutional concerns detected
            </div>
          )}
        </div>
      </PlanSection>

      {/* Risk Register */}
      <PlanSection
        title="Risk Analysis"
        icon={AlertTriangle}
        badge={
          <span
            className={cn(
              'px-1.5 py-0.5 text-[10px] font-medium rounded border',
              plan.riskAnalysis.overallRisk === 'low'
                ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30'
                : plan.riskAnalysis.overallRisk === 'medium'
                  ? 'text-amber-400 bg-amber-400/10 border-amber-400/30'
                  : 'text-red-400 bg-red-400/10 border-red-400/30',
            )}
          >
            {plan.riskAnalysis.overallRisk} risk
          </span>
        }
      >
        {plan.riskAnalysis.risks.length > 0 ? (
          <div className="space-y-2">
            {plan.riskAnalysis.risks.map((risk, i) => {
              const Icon = SEVERITY_ICON[risk.severity];
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Icon
                    className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', SEVERITY_COLOR[risk.severity])}
                  />
                  <div>
                    <span className="font-medium text-foreground">{risk.label}</span>
                    <p className="text-foreground/70 mt-0.5">{risk.mitigation}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No significant risks identified.</p>
        )}
      </PlanSection>

      {/* Similar Proposals */}
      {plan.similarProposals.proposals.length > 0 && (
        <PlanSection title="Similar Proposals" icon={History}>
          <div className="space-y-2">
            {plan.similarProposals.precedentSummary && (
              <p className="text-xs text-foreground/80 mb-2">
                {plan.similarProposals.precedentSummary}
              </p>
            )}
            {plan.similarProposals.proposals.map((p, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs border border-border/20 rounded px-2 py-1.5"
              >
                <FileText className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{p.title}</div>
                  <div className="text-muted-foreground">
                    {p.type} · {p.outcome}
                  </div>
                  <div className="text-foreground/60 mt-0.5">{p.relevance}</div>
                </div>
              </div>
            ))}
          </div>
        </PlanSection>
      )}

      {/* Recommended Improvements */}
      {plan.improvements.length > 0 && (
        <PlanSection title="Recommended Improvements" icon={Lightbulb} defaultOpen>
          <div className="space-y-1.5">
            {[...plan.improvements]
              .sort((a, b) => b.confidence - a.confidence)
              .map((imp, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <div
                    className={cn(
                      'h-1.5 w-1.5 rounded-full shrink-0 mt-1.5',
                      imp.confidence >= 0.8
                        ? 'bg-amber-400'
                        : imp.confidence >= 0.5
                          ? 'bg-blue-400'
                          : 'bg-muted-foreground/40',
                    )}
                  />
                  <div>
                    <span className="font-medium text-foreground capitalize">{imp.field}</span>
                    <span className="text-foreground/70"> — {imp.suggestion}</span>
                  </div>
                </div>
              ))}
          </div>
        </PlanSection>
      )}

      {/* Accept button */}
      <button
        onClick={handleAccept}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
      >
        Enter Editor
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
