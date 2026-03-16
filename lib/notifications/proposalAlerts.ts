/**
 * Pure functions for matching proposals against user interest profiles.
 * No API calls — works entirely with pre-loaded data.
 */

/** The 6 alignment dimensions from proposal classification. */
export interface ProposalDimensions {
  dimTreasuryConservative: number;
  dimTreasuryGrowth: number;
  dimDecentralization: number;
  dimSecurity: number;
  dimInnovation: number;
  dimTransparency: number;
}

/** User profile expressed as interest weights (0-1) per dimension. */
export interface UserInterestProfile {
  treasuryConservative: number;
  treasuryGrowth: number;
  decentralization: number;
  security: number;
  innovation: number;
  transparency: number;
}

export interface ProposalMatchResult {
  /** Relevance score 0-100 */
  relevanceScore: number;
  /** Which dimensions matched (above threshold) */
  matchingDimensions: string[];
  /** Human-readable alert text */
  suggestedAlertText: string;
}

const DIMENSION_LABELS: Record<string, string> = {
  treasuryConservative: 'Treasury Restraint',
  treasuryGrowth: 'Treasury Investment',
  decentralization: 'Decentralization',
  security: 'Security',
  innovation: 'Innovation',
  transparency: 'Transparency',
};

const DIMENSION_MAP: { profileKey: keyof UserInterestProfile; dimKey: keyof ProposalDimensions }[] =
  [
    { profileKey: 'treasuryConservative', dimKey: 'dimTreasuryConservative' },
    { profileKey: 'treasuryGrowth', dimKey: 'dimTreasuryGrowth' },
    { profileKey: 'decentralization', dimKey: 'dimDecentralization' },
    { profileKey: 'security', dimKey: 'dimSecurity' },
    { profileKey: 'innovation', dimKey: 'dimInnovation' },
    { profileKey: 'transparency', dimKey: 'dimTransparency' },
  ];

/**
 * Match a proposal's classification dimensions against a user's interest profile.
 * Returns a relevance score (0-100), matching dimensions, and suggested alert text.
 *
 * Pure function — no side effects or API calls.
 */
export function matchProposalToInterests(
  proposalDimensions: ProposalDimensions,
  userProfile: UserInterestProfile,
): ProposalMatchResult {
  let weightedSum = 0;
  let totalWeight = 0;
  const matchingDimensions: string[] = [];

  for (const { profileKey, dimKey } of DIMENSION_MAP) {
    const userWeight = userProfile[profileKey];
    const proposalRelevance = proposalDimensions[dimKey];

    // Only count dimensions where both user interest and proposal relevance are > 0.2
    if (userWeight > 0.2 && proposalRelevance > 0.2) {
      const contribution = userWeight * proposalRelevance;
      weightedSum += contribution;
      totalWeight += userWeight;

      // Mark as matching if the combined signal is strong enough
      if (contribution > 0.15) {
        matchingDimensions.push(DIMENSION_LABELS[profileKey] || profileKey);
      }
    } else {
      totalWeight += userWeight * 0.1; // Small denominator contribution for non-matches
    }
  }

  // Normalize to 0-100
  const relevanceScore =
    totalWeight > 0 ? Math.round(Math.min(100, (weightedSum / totalWeight) * 100)) : 0;

  // Build alert text
  let suggestedAlertText: string;
  if (matchingDimensions.length === 0) {
    suggestedAlertText = '';
  } else if (matchingDimensions.length === 1) {
    suggestedAlertText = `Matches your ${matchingDimensions[0].toLowerCase()} priorities`;
  } else {
    suggestedAlertText = `Matches your priorities: ${matchingDimensions.slice(0, 3).join(', ')}`;
  }

  return {
    relevanceScore,
    matchingDimensions,
    suggestedAlertText,
  };
}

/**
 * Build a default user interest profile from dimension scores (0-100 each).
 * Normalizes to 0-1 range for matching.
 */
export function profileFromDimensionScores(scores: {
  treasuryConservative: number | null;
  treasuryGrowth: number | null;
  decentralization: number | null;
  security: number | null;
  innovation: number | null;
  transparency: number | null;
}): UserInterestProfile {
  return {
    treasuryConservative: (scores.treasuryConservative ?? 50) / 100,
    treasuryGrowth: (scores.treasuryGrowth ?? 50) / 100,
    decentralization: (scores.decentralization ?? 50) / 100,
    security: (scores.security ?? 50) / 100,
    innovation: (scores.innovation ?? 50) / 100,
    transparency: (scores.transparency ?? 50) / 100,
  };
}
