'use client';

/**
 * ConstitutionalRisk — Ambient annotation for proposal pages.
 *
 * Shows constitutional risk indicators with article citations.
 * Expandable provenance chain: source data -> AI reasoning -> conclusion.
 *
 * Pattern: Harvey AI/Elicit sentence-level citations.
 * "May conflict with Article 3.2 — [Show reasoning]"
 */

import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { AnnotationBase, type ProvenanceStep } from './AnnotationBase';
import { useFeatureFlag } from '@/components/FeatureGate';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface ConstitutionalRiskData {
  /** Risk level assessment */
  riskLevel: RiskLevel;
  /** Short description of the risk */
  summary: string;
  /** Constitutional articles potentially affected */
  articles: string[];
  /** Provenance chain for this assessment */
  provenance: ProvenanceStep[];
}

interface ConstitutionalRiskProps {
  risk: ConstitutionalRiskData | null | undefined;
  className?: string;
}

const RISK_CONFIG: Record<RiskLevel, { variant: 'success' | 'warning' | 'info'; label: string }> = {
  low: { variant: 'success', label: 'Low constitutional risk' },
  medium: { variant: 'warning', label: 'Potential constitutional concern' },
  high: { variant: 'warning', label: 'Constitutional risk identified' },
};

export function ConstitutionalRisk({ risk, className }: ConstitutionalRiskProps) {
  const flagEnabled = useFeatureFlag('ambient_annotations');
  if (flagEnabled === false || !risk) return null;

  const config = RISK_CONFIG[risk.riskLevel];
  const Icon = risk.riskLevel === 'low' ? ShieldCheck : AlertTriangle;
  const articleText =
    risk.articles.length > 0 ? ` (${risk.articles.map((a) => `Article ${a}`).join(', ')})` : '';

  return (
    <AnnotationBase
      icon={<Icon className="h-3.5 w-3.5" />}
      text={`${risk.summary}${articleText}`}
      variant={config.variant}
      provenance={risk.provenance}
      className={className}
      data-testid="constitutional-risk-annotation"
    />
  );
}

/**
 * Generate constitutional risk data from proposal classification.
 *
 * This is a data-driven assessment, not LLM-generated.
 * It maps proposal type + classification signals to constitutional risk.
 */
export function assessConstitutionalRisk(proposal: {
  proposalType: string;
  relevantPrefs?: string[] | null;
  treasuryTier?: string | null;
  withdrawalAmount?: number | null;
}): ConstitutionalRiskData | null {
  const provenance: ProvenanceStep[] = [];
  let riskLevel: RiskLevel = 'low';
  const articles: string[] = [];
  const concerns: string[] = [];

  // HardForkInitiation always has constitutional significance
  if (proposal.proposalType === 'HardForkInitiation') {
    riskLevel = 'high';
    articles.push('3.6');
    concerns.push('Hard fork requires broad consensus per constitutional guidelines');
    provenance.push({
      label: 'Proposal type',
      detail: 'HardForkInitiation triggers Article 3.6 review requirements',
    });
  }

  // NoConfidence is constitutionally significant
  if (proposal.proposalType === 'NoConfidence') {
    riskLevel = 'high';
    articles.push('6.1');
    concerns.push('No-confidence motion affects constitutional committee standing');
    provenance.push({
      label: 'Proposal type',
      detail: 'NoConfidence triggers Article 6.1 governance mechanism',
    });
  }

  // NewConstitution
  if (proposal.proposalType === 'NewConstitution') {
    riskLevel = 'high';
    articles.push('7.1');
    concerns.push('Constitutional amendment requires supermajority approval');
    provenance.push({
      label: 'Proposal type',
      detail: 'NewConstitution triggers Article 7.1 amendment process',
    });
  }

  // Large treasury withdrawals
  if (proposal.proposalType === 'TreasuryWithdrawals') {
    const amount = proposal.withdrawalAmount ?? 0;
    const adaAmount = amount / 1_000_000;
    if (proposal.treasuryTier === 'whale' || adaAmount > 10_000_000) {
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
      articles.push('3.2');
      concerns.push('Large treasury withdrawal warrants fiscal responsibility review');
      provenance.push({
        label: 'Treasury impact',
        detail: `${(adaAmount / 1_000_000).toFixed(1)}M ADA withdrawal against treasury sustainability guardrails`,
      });
    }
  }

  // Relevant prefs / guardrails
  if (proposal.relevantPrefs && proposal.relevantPrefs.length > 0) {
    provenance.push({
      label: 'Guardrail parameters',
      detail: `Proposal modifies: ${proposal.relevantPrefs.slice(0, 3).join(', ')}${proposal.relevantPrefs.length > 3 ? ` (+${proposal.relevantPrefs.length - 3} more)` : ''}`,
    });
    if (proposal.proposalType === 'ParameterChange') {
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
      articles.push('3.5');
    }
  }

  // Only return if there's something to report
  if (concerns.length === 0) return null;

  provenance.push({
    label: 'Assessment',
    detail: concerns.join('. '),
  });

  return {
    riskLevel,
    summary: concerns[0],
    articles,
    provenance,
  };
}
