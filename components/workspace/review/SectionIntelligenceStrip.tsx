'use client';

/**
 * SectionIntelligenceStrip — compact AI analysis strip shown between section
 * header and content in ProposalContent during review.
 *
 * Lazy-loads: invokes section-analysis skill when the section is expanded.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAISkill } from '@/hooks/useAISkill';
import { SectionHealthBadge } from '@/components/workspace/shared/SectionHealthBadge';
import { ProvenanceBadge } from '@/components/workspace/shared/ProvenanceBadge';
import type { SectionAnalysisOutput } from '@/lib/ai/skills/section-analysis';

interface SectionIntelligenceStripProps {
  field: 'abstract' | 'motivation' | 'rationale';
  content: string;
  proposalType: string;
  proposalTxHash: string;
  proposalIndex: number;
}

export function SectionIntelligenceStrip({
  field,
  content,
  proposalType,
  proposalTxHash,
  proposalIndex,
}: SectionIntelligenceStripProps) {
  const skill = useAISkill<SectionAnalysisOutput>();
  const [result, setResult] = useState<SectionAnalysisOutput | null>(null);
  const [provenance, setProvenance] = useState<{
    model: string;
    keySource: 'platform' | 'byok';
  } | null>(null);
  const invokedRef = useRef(false);

  const invoke = useCallback(() => {
    if (invokedRef.current || !content || content.length < 20) return;
    invokedRef.current = true;
    skill.mutate(
      {
        skill: 'section-analysis',
        input: { field, content, proposalType },
        proposalTxHash,
        proposalIndex,
      },
      {
        onSuccess: (data) => {
          setResult(data.output);
          setProvenance({ model: data.provenance.model, keySource: data.provenance.keySource });
        },
      },
    );
  }, [field, content, proposalType, proposalTxHash, proposalIndex, skill]);

  useEffect(() => {
    invoke();
  }, [invoke]);

  // Loading
  if (skill.isPending && !result) {
    return (
      <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-1.5">
        <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40 animate-pulse" />
        <div className="h-3 w-48 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  if (!result) return null;

  const flagCount = result.constitutionalFlags.length;
  const gapCount = result.completenessGaps.length;

  return (
    <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-1.5 text-xs">
      <SectionHealthBadge
        quality={result.overallQuality}
        flagCount={flagCount}
        gapCount={gapCount}
      />
      <span className="text-muted-foreground flex-1 truncate">{result.summary}</span>
      {flagCount > 0 && (
        <span className="text-amber-600 dark:text-amber-400 shrink-0">
          {flagCount} {flagCount === 1 ? 'flag' : 'flags'}
        </span>
      )}
      {gapCount > 0 && (
        <span className="text-muted-foreground shrink-0">
          {gapCount} {gapCount === 1 ? 'gap' : 'gaps'}
        </span>
      )}
      {provenance && (
        <ProvenanceBadge
          model={provenance.model}
          keySource={provenance.keySource}
          skillName="section-analysis"
        />
      )}
    </div>
  );
}
