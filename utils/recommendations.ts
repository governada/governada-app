import { VoteRecord } from '@/types/drep';
import { getMissingProfileFields, applyRationaleCurve, getPillarStatus } from '@/utils/scoring';

export interface Recommendation {
  pillar: 'participation' | 'rationale' | 'reliability' | 'profile';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potentialGain: number;
}

interface DRepData {
  effectiveParticipation: number;
  rationaleRate: number;
  reliabilityScore: number;
  profileCompleteness: number;
  deliberationModifier: number;
  metadata: Record<string, unknown> | null;
  votes: VoteRecord[];
  brokenLinks?: string[];
}

const RATIONALE_EXEMPT_TYPES = ['InfoAction'];

/**
 * Generate actionable improvement recommendations for a DRep,
 * sorted by estimated point gain (highest first).
 *
 * Potential gain estimates are conservative lower-bounds to avoid
 * over-promising score improvements.
 */
export function generateRecommendations(drep: DRepData): Recommendation[] {
  const recs: Recommendation[] = [];

  // --- Profile Completeness ---
  if (drep.profileCompleteness < 100) {
    const brokenUris = new Set<string>(drep.brokenLinks ?? []);
    const missing = getMissingProfileFields(drep.metadata, brokenUris);
    if (missing.length > 0) {
      const pointsPerField: Record<string, number> = {
        name: 15,
        objectives: 20,
        motivations: 15,
        qualifications: 10,
        bio: 10,
        'social links': 25,
        'a second social link (2+ recommended)': 5,
      };
      const gain = missing.reduce((sum, f) => sum + (pointsPerField[f] || 5), 0);
      const weightedGain = Math.round(Math.min(gain, 100 - drep.profileCompleteness) * 0.15);

      recs.push({
        pillar: 'profile',
        priority: drep.profileCompleteness < 50 ? 'high' : 'medium',
        title: 'Complete your profile metadata',
        description: `Missing: ${missing.join(', ')}. This is the easiest improvement — no on-chain transactions needed.`,
        potentialGain: Math.max(1, weightedGain),
      });
    }
  }

  // --- Broken Social Links ---
  if (drep.brokenLinks && drep.brokenLinks.length > 0) {
    recs.push({
      pillar: 'profile',
      priority: 'high',
      title: `${drep.brokenLinks.length} broken social link${drep.brokenLinks.length > 1 ? 's' : ''}`,
      description: `Fix or update: ${drep.brokenLinks.slice(0, 2).join(', ')}. Broken links don't count toward Profile Completeness.`,
      potentialGain: Math.max(1, Math.round(drep.brokenLinks.length * 2)),
    });
  }

  // --- Rationale Rate (highest-weighted pillar at 35%) ---
  const adjustedRationale = applyRationaleCurve(drep.rationaleRate);
  if (adjustedRationale < 60) {
    const bindingVotes = drep.votes.filter(
      (v) => !RATIONALE_EXEMPT_TYPES.includes(v.proposalType || ''),
    );
    const withoutRationale = bindingVotes.filter((v) => !v.hasRationale);
    const criticalMissing = withoutRationale.filter((v) =>
      [
        'HardForkInitiation',
        'NoConfidence',
        'NewConstitutionalCommittee',
        'UpdateConstitution',
      ].includes(v.proposalType || ''),
    );

    if (criticalMissing.length > 0) {
      recs.push({
        pillar: 'rationale',
        priority: 'high',
        title: 'Provide rationale on critical votes',
        description: `You have ${criticalMissing.length} critical governance vote${criticalMissing.length > 1 ? 's' : ''} without rationale. Critical votes count 3x in your score.`,
        potentialGain: Math.min(10, Math.round(criticalMissing.length * 2.5)),
      });
    }

    if (withoutRationale.length > 0) {
      const recentMissing = withoutRationale.slice(0, 5);
      const titles = recentMissing.map((v) => v.title || 'Unknown').join(', ');
      recs.push({
        pillar: 'rationale',
        priority: adjustedRationale < 30 ? 'high' : 'medium',
        title: `${withoutRationale.length} binding votes without rationale`,
        description: `Recent: ${titles}. Rationale is the highest-weighted pillar (35%) — improving this has the biggest impact on your score.`,
        potentialGain: Math.min(8, Math.round(withoutRationale.length * 0.7)),
      });
    }
  }

  // --- Effective Participation ---
  if (drep.effectiveParticipation < 80) {
    recs.push({
      pillar: 'participation',
      priority: drep.effectiveParticipation < 50 ? 'high' : 'medium',
      title: 'Vote on more proposals',
      description: `Your effective participation is ${drep.effectiveParticipation}%. Voting on every available proposal is the most direct way to improve this.`,
      potentialGain: Math.min(8, Math.round((80 - drep.effectiveParticipation) * 0.3)),
    });

    if (drep.deliberationModifier < 1.0) {
      const discount = Math.round((1 - drep.deliberationModifier) * 100);
      recs.push({
        pillar: 'participation',
        priority: 'low',
        title: 'Diversify your voting pattern',
        description: `Your participation is discounted ${discount}% because your votes appear uniform. Voting differently on proposals you genuinely disagree with will remove this penalty.`,
        potentialGain: Math.round(
          drep.effectiveParticipation * (1 - drep.deliberationModifier) * 0.3,
        ),
      });
    }
  }

  // --- Reliability ---
  if (drep.reliabilityScore < 70) {
    recs.push({
      pillar: 'reliability',
      priority: drep.reliabilityScore < 50 ? 'high' : 'medium',
      title: 'Build your voting streak',
      description: `Your reliability score is ${drep.reliabilityScore}%. Vote in every epoch with proposals to build your streak and show delegators you're consistently engaged.`,
      potentialGain: Math.min(6, Math.round((70 - drep.reliabilityScore) * 0.2)),
    });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => {
    if (b.potentialGain !== a.potentialGain) return b.potentialGain - a.potentialGain;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return recs;
}

/**
 * Get votes where rationale is missing, ordered by importance (critical first).
 * Excludes exempt types like InfoAction.
 */
export function getMissingRationaleVotes(votes: VoteRecord[]): VoteRecord[] {
  const criticalTypes = [
    'HardForkInitiation',
    'NoConfidence',
    'NewConstitutionalCommittee',
    'UpdateConstitution',
  ];
  const importantTypes = ['ParameterChange'];

  return votes
    .filter((v) => !v.hasRationale && !RATIONALE_EXEMPT_TYPES.includes(v.proposalType || ''))
    .sort((a, b) => {
      const getWeight = (v: VoteRecord) => {
        if (criticalTypes.includes(v.proposalType || '')) return 3;
        if (importantTypes.includes(v.proposalType || '')) return 2;
        return 1;
      };
      return getWeight(b) - getWeight(a);
    });
}
