'use client';

/**
 * SimilarProposalsSection — precedent research for intelligence brief.
 *
 * Wraps the same useAISkill('research-precedent') pattern as IntelPanel's
 * SimilarProposalsCard. Lazy-loads on mount (section expand handled by BriefShell).
 */

import { useCallback, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAISkill } from '@/hooks/useAISkill';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SimilarProposal {
  txHash: string;
  title: string;
  proposalType: string;
  withdrawalAmount: number | null;
  status: string;
  comparison: string;
}

interface ResearchPrecedentOutput {
  similarProposals: SimilarProposal[];
  precedentSummary: string;
  questionsToConsider: string[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SimilarProposalsSectionProps {
  proposalContent: {
    title: string;
    abstract: string;
  };
  proposalType: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SimilarProposalsSection({
  proposalContent,
  proposalType,
}: SimilarProposalsSectionProps) {
  const skill = useAISkill<ResearchPrecedentOutput>();
  const hasFetched = useRef(false);

  const fetchIfNeeded = useCallback(() => {
    if (hasFetched.current || skill.isPending) return;
    hasFetched.current = true;
    skill.mutate({
      skill: 'research-precedent',
      input: {
        proposalTitle: proposalContent.title,
        proposalAbstract: proposalContent.abstract,
        proposalType,
      },
    });
  }, [skill, proposalContent, proposalType]);

  // Auto-fetch when section is rendered (i.e., expanded)
  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  if (skill.isPending) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Researching precedents...</span>
      </div>
    );
  }

  if (skill.isError) {
    return <p className="text-xs text-red-400 py-1">{skill.error.message}</p>;
  }

  if (!skill.data?.output) {
    return <p className="text-xs text-muted-foreground/60 py-1">Expand to search for precedents</p>;
  }

  const { similarProposals, precedentSummary, questionsToConsider } = skill.data.output;

  return (
    <div className="space-y-3 text-xs">
      {similarProposals.length > 0 ? (
        <div className="space-y-2">
          {similarProposals.map((p, i) => (
            <div key={i} className="rounded bg-muted/20 px-2 py-1.5 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground truncate">{p.title}</span>
                <span
                  className={cn(
                    'text-[10px] shrink-0 font-medium',
                    p.status === 'ratified'
                      ? 'text-emerald-400'
                      : p.status === 'expired'
                        ? 'text-amber-400'
                        : p.status === 'dropped'
                          ? 'text-red-400'
                          : 'text-muted-foreground',
                  )}
                >
                  {p.status}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{p.comparison}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground/60">No similar proposals found</p>
      )}

      {precedentSummary && (
        <p className="text-muted-foreground leading-relaxed border-t border-border pt-2">
          {precedentSummary}
        </p>
      )}

      {questionsToConsider.length > 0 && (
        <div className="border-t border-border pt-2 space-y-1">
          <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide">
            Consider
          </span>
          <ul className="space-y-1">
            {questionsToConsider.map((q, i) => (
              <li
                key={i}
                className="text-[11px] text-muted-foreground leading-relaxed pl-2 border-l-2 border-muted"
              >
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
