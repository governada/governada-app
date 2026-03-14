'use client';

import { Sparkles } from 'lucide-react';
import { ProposalAiSummary } from '@/components/ProposalAiSummary';
import { ConstitutionalAlignmentCard } from '@/components/ConstitutionalAlignmentCard';
import { ParamChangesCard } from '@/components/governada/proposals/ParamChangesCard';

interface IntelligenceBriefingProps {
  txHash: string;
  proposalIndex: number;
  aiSummary: string | null;
  proposalType: string;
  paramChanges: Record<string, unknown> | null;
}

export function IntelligenceBriefing({
  txHash,
  proposalIndex,
  aiSummary,
  proposalType,
  paramChanges,
}: IntelligenceBriefingProps) {
  const hasParams = proposalType === 'ParameterChange' && paramChanges;

  return (
    <section className="rounded-2xl border border-border/50 bg-muted/20 overflow-hidden">
      <div className="px-6 py-4 border-b border-border/50">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Intelligence Briefing
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          AI analysis and constitutional context
        </p>
      </div>

      <div className="p-6 space-y-6">
        {aiSummary && <ProposalAiSummary summary={aiSummary} />}
        <ConstitutionalAlignmentCard txHash={txHash} proposalIndex={proposalIndex} />
        {hasParams && <ParamChangesCard paramChanges={paramChanges} />}
      </div>
    </section>
  );
}
