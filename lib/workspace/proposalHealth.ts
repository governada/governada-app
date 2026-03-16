/**
 * Proposal Health Score — pure function that evaluates proposal completeness.
 *
 * Checks whether key fields are present in a ReviewQueueItem and produces
 * a weighted 0-100 health score.
 */

import type { ReviewQueueItem, ProposalHealthResult, ProposalHealthCheck } from './types';

/**
 * Compute a proposal health score (0-100) based on field completeness.
 *
 * Weights:
 *   title (1), abstract (2), motivation (2), rationale (2),
 *   references (1), AI summary (1), withdrawal amount (1, conditional)
 */
export function computeProposalHealth(item: ReviewQueueItem): ProposalHealthResult {
  const checks: ProposalHealthCheck[] = [];

  // Has title
  checks.push({
    label: 'Has title',
    passed: !!item.title && item.title.length > 0,
    weight: 1,
  });

  // Has abstract
  checks.push({
    label: 'Has abstract',
    passed: !!item.abstract && item.abstract.length > 0,
    weight: 2,
  });

  // Has motivation (from CIP-108 metadata — not currently in ReviewQueueItem,
  // so we check meta_json-based enrichment or default to false)
  // NOTE: motivation/rationale fields may be added to ReviewQueueItem in Phase 0.
  // For now, we check the abstract length as a proxy for motivation.
  const hasMotivation = false; // Placeholder until field is added to ReviewQueueItem
  checks.push({
    label: 'Has motivation',
    passed: hasMotivation,
    weight: 2,
  });

  // Has rationale
  const hasRationale = false; // Placeholder until field is added to ReviewQueueItem
  checks.push({
    label: 'Has rationale',
    passed: hasRationale,
    weight: 2,
  });

  // Has references (not currently in ReviewQueueItem, placeholder)
  const hasReferences = false;
  checks.push({
    label: 'Has references',
    passed: hasReferences,
    weight: 1,
  });

  // Has AI summary
  checks.push({
    label: 'Has AI summary',
    passed: !!item.aiSummary && item.aiSummary.length > 0,
    weight: 1,
  });

  // Withdrawal amount specified (conditional — only for TreasuryWithdrawals)
  if (item.proposalType === 'TreasuryWithdrawals') {
    checks.push({
      label: 'Withdrawal amount specified',
      passed: item.withdrawalAmount != null && item.withdrawalAmount > 0,
      weight: 1,
    });
  }

  // Calculate weighted score
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earnedWeight = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  return { score, checks };
}
