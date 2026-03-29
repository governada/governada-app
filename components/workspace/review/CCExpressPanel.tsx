'use client';

/**
 * CCExpressPanel — constitutional-only assessment panel for CC members.
 *
 * Shows article-by-article PASS/ADVISORY/FAIL assessment with one-click
 * accept and per-article override controls. Generates a structured
 * constitutional opinion for the rationale field.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Shield, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAISkill } from '@/hooks/useAISkill';
import { posthog } from '@/lib/posthog';
import { CCArticleRow } from './CCArticleRow';
import type { CCArticleAssessmentOutput } from '@/lib/ai/skills/cc-article-assessment';

interface CCExpressPanelProps {
  proposalContent: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
  proposalType: string;
  typeSpecific?: Record<string, unknown>;
  onAcceptAll: (rationaleText: string) => void;
}

/** Build a structured constitutional opinion from the assessment */
function buildConstitutionalOpinion(
  assessment: CCArticleAssessmentOutput,
  overrides: Map<string, { verdict: string; reason: string }>,
): string {
  const lines: string[] = [`Constitutional Assessment: ${assessment.overallVerdict}`, ''];

  for (const article of assessment.articles) {
    const override = overrides.get(article.article);
    const verdict = override ? override.verdict : article.verdict;
    const isHuman = !!override;

    lines.push(`${article.article}: ${verdict}${isHuman ? ' [Human override]' : ''}`);
    if (override?.reason) {
      lines.push(`  Override reason: ${override.reason}`);
    } else {
      lines.push(`  ${article.reasoning}`);
    }
    lines.push('');
  }

  if (assessment.summary) {
    lines.push(assessment.summary);
  }

  return lines.join('\n');
}

export function CCExpressPanel({
  proposalContent,
  proposalType,
  typeSpecific,
  onAcceptAll,
}: CCExpressPanelProps) {
  const skill = useAISkill<CCArticleAssessmentOutput>();
  const [result, setResult] = useState<CCArticleAssessmentOutput | null>(null);
  const [overrides, setOverrides] = useState<
    Map<string, { verdict: 'PASS' | 'ADVISORY' | 'FAIL'; reason: string }>
  >(new Map());

  const initiatedRef = useRef(false);

  useEffect(() => {
    if (initiatedRef.current || result) return;
    initiatedRef.current = true;

    skill.mutate(
      {
        skill: 'cc-article-assessment',
        input: { proposalContent, proposalType, typeSpecific },
      },
      {
        onSuccess: (data) => {
          setResult(data.output);
          posthog.capture('cc_express_generated', {
            articleCount: data.output.articles.length,
            overallVerdict: data.output.overallVerdict,
            failCount: data.output.articles.filter((a) => a.verdict === 'FAIL').length,
          });
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOverride = useCallback(
    (article: string, newVerdict: 'PASS' | 'ADVISORY' | 'FAIL', reason: string) => {
      posthog.capture('cc_express_article_overridden', { article, newVerdict });
      setOverrides((prev) => {
        const next = new Map(prev);
        next.set(article, { verdict: newVerdict, reason });
        return next;
      });
    },
    [],
  );

  const handleAccept = useCallback(() => {
    if (!result) return;
    posthog.capture('cc_express_accepted', {
      overrideCount: overrides.size,
      overallVerdict: result.overallVerdict,
    });
    const opinion = buildConstitutionalOpinion(result, overrides);
    onAcceptAll(opinion);
  }, [result, overrides, onAcceptAll]);

  // Loading
  if (skill.isPending && !result) {
    return (
      <div className="px-3 py-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--compass-teal)]" />
          <span className="text-xs text-muted-foreground">Running constitutional analysis...</span>
        </div>
      </div>
    );
  }

  if (!result) return null;

  // Compute effective overall verdict considering overrides
  const effectiveVerdict = result.articles.some((a) => {
    const override = overrides.get(a.article);
    return (override?.verdict ?? a.verdict) === 'FAIL';
  })
    ? 'FAIL'
    : result.articles.some((a) => {
          const override = overrides.get(a.article);
          return (override?.verdict ?? a.verdict) === 'ADVISORY';
        })
      ? 'ADVISORY'
      : 'PASS';

  const verdictColor =
    effectiveVerdict === 'PASS'
      ? 'text-emerald-400'
      : effectiveVerdict === 'ADVISORY'
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <div className="px-3 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className={cn('h-4 w-4', verdictColor)} />
        <div className="flex-1">
          <h4 className="text-xs font-semibold text-foreground">Constitutional Assessment</h4>
          <p className="text-[10px] text-muted-foreground">
            Article-by-article review for CC member decision
          </p>
        </div>
        <span
          className={cn(
            'px-2 py-0.5 text-[10px] font-bold rounded border',
            effectiveVerdict === 'PASS'
              ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30'
              : effectiveVerdict === 'ADVISORY'
                ? 'text-amber-400 bg-amber-400/10 border-amber-400/30'
                : 'text-red-400 bg-red-400/10 border-red-400/30',
          )}
        >
          {effectiveVerdict}
        </span>
      </div>

      {/* Summary */}
      {result.summary && (
        <p className="text-xs text-foreground/70 leading-relaxed">{result.summary}</p>
      )}

      {/* Article rows */}
      <div className="space-y-1.5">
        {result.articles.map((article) => (
          <CCArticleRow
            key={article.article}
            assessment={article}
            isOverridden={overrides.has(article.article)}
            overriddenVerdict={overrides.get(article.article)?.verdict}
            onOverride={handleOverride}
          />
        ))}
      </div>

      {/* Accept button */}
      <button
        onClick={handleAccept}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-[var(--compass-teal)] text-primary-foreground hover:bg-[var(--compass-teal)]/90 transition-colors cursor-pointer"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Accept Assessment
        {overrides.size > 0 && (
          <span className="text-[9px] opacity-70">
            ({overrides.size} override{overrides.size !== 1 ? 's' : ''})
          </span>
        )}
      </button>
    </div>
  );
}
