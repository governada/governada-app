/**
 * Rule-based archetype classification for CC members.
 *
 * Each CC member is assigned an archetype based on their voting behavior,
 * rationale quality, article citation patterns, bloc membership, and tenure.
 *
 * Rules are evaluated in priority order — first match wins.
 */

export interface ArchetypeInput {
  ccHotId: string;
  approvalRate: number; // % of Yes votes (0-100)
  rationaleProvisionRate: number; // % of votes with rationale (0-100)
  uniqueArticlesCited: number;
  totalCitations: number;
  articlesCited: string[];
  soleDissenterCount: number;
  blocAssignment: string; // 'Bloc A', 'Independent', etc.
  authorizationEpoch: number | null;
  currentEpoch: number;
}

export interface ArchetypeResult {
  label: string;
  description: string;
  strictnessScore: number; // 0-100
  independenceProfile: 'independent' | 'consensus-leaning' | 'bloc-aligned';
}

/**
 * Classify a CC member into an archetype based on behavioral rules.
 *
 * Rules (evaluated in order, first match wins):
 * 1. New Guardian — authorized within last 2 epochs
 * 2. Silent Voter — rationale provision rate < 40%
 * 3. Treasury Guardian — strict (strictness >= 70) AND well-cited (>= 5 unique articles)
 * 4. Constitutional Purist — broad coverage (>= 7 unique articles) AND high citation volume (>= 100)
 * 5. Independent Voice — independent AND at least 1 sole dissent
 * 6. Consensus Builder — in a bloc AND never sole dissenter
 * 7. Pragmatic Interpreter — permissive (approval >= 90%)
 * 8. Fallback: Active Member
 */
export function classifyArchetype(input: ArchetypeInput): ArchetypeResult {
  const strictnessScore = Math.max(0, Math.min(100, 100 - input.approvalRate));
  const independenceProfile = computeIndependenceProfile(input.blocAssignment);

  // Rule 1: New Guardian
  if (input.authorizationEpoch !== null && input.currentEpoch - input.authorizationEpoch <= 2) {
    return {
      label: 'New Guardian',
      description: 'Recently authorized committee member still establishing their voting pattern.',
      strictnessScore,
      independenceProfile,
    };
  }

  // Rule 2: Silent Voter
  if (input.rationaleProvisionRate < 40) {
    return {
      label: 'Silent Voter',
      description: 'Votes consistently but rarely provides constitutional rationale for decisions.',
      strictnessScore,
      independenceProfile,
    };
  }

  // Rule 3: Treasury Guardian
  if (strictnessScore >= 70 && input.uniqueArticlesCited >= 5) {
    return {
      label: 'Treasury Guardian',
      description:
        'Applies strict constitutional standards with thorough article citations. Acts as a check on governance proposals.',
      strictnessScore,
      independenceProfile,
    };
  }

  // Rule 4: Constitutional Purist
  if (input.uniqueArticlesCited >= 7 && input.totalCitations >= 100) {
    return {
      label: 'Constitutional Purist',
      description:
        'Demonstrates exceptionally broad constitutional knowledge, citing articles across all sections of the constitution.',
      strictnessScore,
      independenceProfile,
    };
  }

  // Rule 5: Independent Voice
  if (input.blocAssignment === 'Independent' && input.soleDissenterCount >= 1) {
    return {
      label: 'Independent Voice',
      description:
        'Votes independently from the majority and has stood as sole dissenter on at least one proposal.',
      strictnessScore,
      independenceProfile,
    };
  }

  // Rule 6: Consensus Builder
  if (input.blocAssignment.startsWith('Bloc') && input.soleDissenterCount === 0) {
    return {
      label: 'Consensus Builder',
      description:
        'Consistently aligns with a bloc of like-minded members and never stands as sole dissenter.',
      strictnessScore,
      independenceProfile,
    };
  }

  // Rule 7: Pragmatic Interpreter
  if (input.approvalRate >= 90) {
    return {
      label: 'Pragmatic Interpreter',
      description:
        'Takes a permissive approach to governance proposals, approving the vast majority.',
      strictnessScore,
      independenceProfile,
    };
  }

  // Rule 8: Fallback
  return {
    label: 'Active Member',
    description:
      'Actively participates in governance with a balanced approach to constitutional review.',
    strictnessScore,
    independenceProfile,
  };
}

/**
 * Determine independence profile from bloc assignment.
 *
 * - 'independent' if not in any bloc
 * - 'bloc-aligned' if in a bloc (blocs inherently have >= 2 members by detection)
 * - 'consensus-leaning' otherwise
 */
function computeIndependenceProfile(
  blocAssignment: string,
): ArchetypeResult['independenceProfile'] {
  if (blocAssignment === 'Independent') return 'independent';
  if (blocAssignment.startsWith('Bloc')) return 'bloc-aligned';
  return 'consensus-leaning';
}
