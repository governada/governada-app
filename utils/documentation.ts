/**
 * Documentation Quality Utilities
 * Scores and sorts DReps based on metadata completeness
 */

import { DRep } from '@/types/drep';

/**
 * Calculate documentation quality score (0-100)
 * Higher score = better documented
 */
export function calculateDocumentationScore(
  drep: Pick<DRep, 'name' | 'ticker' | 'description' | 'metadata'>,
): number {
  let score = 0;

  // Name: 30 points
  if (drep.name) {
    score += 30;
  }

  // Ticker: 20 points
  if (drep.ticker) {
    score += 20;
  }

  // Description: 30 points (scaled by length)
  if (drep.description) {
    const descLength = drep.description.length;
    if (descLength > 200) {
      score += 30; // Full points for detailed description
    } else if (descLength > 50) {
      score += 20; // Partial points for brief description
    } else {
      score += 10; // Minimal points for very short description
    }
  }

  // Additional metadata: 20 points
  if (drep.metadata) {
    const meta = drep.metadata as Record<string, unknown>;
    if (meta.bio) score += 5;
    if (meta.email) score += 5;
    const refs = meta.references;
    if (Array.isArray(refs) && refs.length > 0) score += 10;
  }

  return Math.min(100, score);
}

/**
 * Check if DRep is well documented
 * Well documented = has name + (ticker or description)
 */
export function isWellDocumented(drep: Pick<DRep, 'name' | 'ticker' | 'description'>): boolean {
  return !!(drep.name && (drep.ticker || drep.description));
}

/**
 * Get documentation quality label
 */
export function getDocumentationLabel(score: number): {
  label: string;
  color: string;
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
} {
  if (score >= 80) {
    return {
      label: 'Excellent',
      color: 'text-green-600 dark:text-green-400',
      variant: 'default',
    };
  } else if (score >= 50) {
    return {
      label: 'Good',
      color: 'text-blue-600 dark:text-blue-400',
      variant: 'outline',
    };
  } else if (score >= 20) {
    return {
      label: 'Minimal',
      color: 'text-yellow-600 dark:text-yellow-400',
      variant: 'secondary',
    };
  } else {
    return {
      label: 'None',
      color: 'text-muted-foreground',
      variant: 'secondary',
    };
  }
}

/**
 * Sort DReps by documentation quality and voting power
 * Priority: Well documented DReps with high voting power first
 */
export function sortByDocumentationQuality(dreps: DRep[]): DRep[] {
  return [...dreps].sort((a, b) => {
    const aDocScore = calculateDocumentationScore(a);
    const bDocScore = calculateDocumentationScore(b);

    // Primary sort: Documentation score (higher first)
    if (aDocScore !== bDocScore) {
      return bDocScore - aDocScore;
    }

    // Secondary sort: Voting power (higher first)
    return b.votingPower - a.votingPower;
  });
}

/**
 * Sort DReps by combined quality score
 * Balances documentation quality with voting power importance
 */
export function sortByQualityScore(dreps: DRep[]): DRep[] {
  return [...dreps].sort((a, b) => {
    // Calculate combined quality score
    const aDocScore = calculateDocumentationScore(a);
    const bDocScore = calculateDocumentationScore(b);

    // Normalize voting power to 0-100 scale
    const maxVotingPower = Math.max(...dreps.map((d) => d.votingPower), 1);
    const aVotingScore = (a.votingPower / maxVotingPower) * 100;
    const bVotingScore = (b.votingPower / maxVotingPower) * 100;

    // Combined score: 60% documentation, 40% voting power
    const aScore = aDocScore * 0.6 + aVotingScore * 0.4;
    const bScore = bDocScore * 0.6 + bVotingScore * 0.4;

    return bScore - aScore;
  });
}

/**
 * Filter to only well-documented DReps
 */
export function filterWellDocumented(dreps: DRep[]): DRep[] {
  return dreps.filter((drep) => isWellDocumented(drep));
}

/**
 * Get documentation completeness percentage
 */
export function getDocumentationCompleteness(
  drep: Pick<DRep, 'name' | 'ticker' | 'description' | 'metadata'>,
): string {
  const score = calculateDocumentationScore(drep);
  return `${score}%`;
}
