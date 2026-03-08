/**
 * Shared test fixtures for scoring test suites.
 * Factory functions with sensible defaults and partial overrides.
 */

import type {
  VoteData,
  ProposalScoringContext,
  ProposalVotingSummary,
  DRepProfileData,
} from '@/lib/scoring/types';

// ── Constants ──

export const NOW = Math.floor(Date.now() / 1000);
export const ONE_DAY = 86400;
export const ONE_EPOCH = 5 * ONE_DAY; // ~5 days per Cardano epoch

// ── Factory: VoteData ──

let voteCounter = 0;

export function makeVoteData(overrides: Partial<VoteData> = {}): VoteData {
  voteCounter++;
  return {
    drepId: 'drep1_test',
    proposalKey: `tx_${voteCounter}-0`,
    vote: 'Yes',
    blockTime: NOW - 10 * ONE_DAY,
    proposalBlockTime: NOW - 15 * ONE_DAY,
    proposalType: 'TreasuryWithdrawals',
    rationaleQuality: 70,
    importanceWeight: 2,
    ...overrides,
  };
}

/**
 * Generate N votes for a DRep with controllable properties.
 */
export function makeVoteSeries(
  drepId: string,
  count: number,
  overrides: Partial<VoteData> = {},
): VoteData[] {
  return Array.from({ length: count }, (_, i) =>
    makeVoteData({
      drepId,
      proposalKey: `tx_${drepId}_${i}-0`,
      blockTime: NOW - (count - i) * ONE_DAY,
      proposalBlockTime: NOW - (count - i) * ONE_DAY - 2 * ONE_DAY,
      ...overrides,
    }),
  );
}

// ── Factory: ProposalScoringContext ──

export function makeProposalContext(
  overrides: Partial<ProposalScoringContext> = {},
): ProposalScoringContext {
  return {
    proposalKey: `tx_prop_${Math.random().toString(36).slice(2, 8)}-0`,
    proposalType: 'TreasuryWithdrawals',
    treasuryTier: null,
    withdrawalAmount: null,
    blockTime: NOW - 30 * ONE_DAY,
    importanceWeight: 2,
    ...overrides,
  };
}

// ── Factory: ProposalVotingSummary ──

export function makeVotingSummary(
  overrides: Partial<ProposalVotingSummary> = {},
): ProposalVotingSummary {
  return {
    proposalKey: 'tx_default-0',
    drepYesVotePower: 5000,
    drepNoVotePower: 3000,
    drepAbstainVotePower: 1000,
    ...overrides,
  };
}

// ── Factory: DRepProfileData ──

export function makeProfile(overrides: Partial<DRepProfileData> = {}): DRepProfileData {
  return {
    drepId: 'drep1_test',
    metadata: {
      givenName: 'Test DRep',
      objectives:
        'Advance Cardano governance through transparent and data-driven decision making for the betterment of the ecosystem and community. '.repeat(
          2,
        ),
      motivations:
        'Passionate about decentralized governance and community-driven development with a long history in the ecosystem.',
      qualifications:
        'Software engineer with 10 years experience in distributed systems and blockchain.',
      bio: 'Active community member since the Shelley era, running a stake pool and contributing to open-source tools.',
      references: [
        { uri: 'https://twitter.com/testdrep', label: 'Twitter' },
        { uri: 'https://github.com/testdrep', label: 'GitHub' },
      ],
    },
    delegatorCount: 50,
    metadataHashVerified: true,
    ...overrides,
  };
}

export function makeEmptyProfile(drepId: string): DRepProfileData {
  return {
    drepId,
    metadata: null,
    delegatorCount: 0,
    metadataHashVerified: false,
  };
}

// ── Bulk generators ──

/**
 * Generate a realistic multi-DRep scenario with mixed voting patterns.
 */
export function makeRealisticScenario(drepCount: number, proposalCount: number) {
  const proposalTypes = [
    'TreasuryWithdrawals',
    'ParameterChange',
    'HardForkInitiation',
    'NoConfidence',
    'InfoAction',
    'NewConstitution',
  ];

  const allProposalTypes = new Set(proposalTypes);

  // Create proposals
  const proposals = Array.from({ length: proposalCount }, (_, i) => {
    const pType = proposalTypes[i % proposalTypes.length];
    return makeProposalContext({
      proposalKey: `tx_p${i}-0`,
      proposalType: pType,
      blockTime: NOW - (proposalCount - i) * 3 * ONE_DAY,
      importanceWeight: pType === 'HardForkInitiation' ? 3 : pType === 'ParameterChange' ? 2 : 1,
    });
  });

  // Create voting summaries (varied margins)
  const votingSummaries = new Map<string, ProposalVotingSummary>();
  for (const p of proposals) {
    const yesRatio = 0.3 + Math.random() * 0.4; // 30-70% yes
    const total = 10000;
    votingSummaries.set(
      p.proposalKey,
      makeVotingSummary({
        proposalKey: p.proposalKey,
        drepYesVotePower: Math.round(total * yesRatio),
        drepNoVotePower: Math.round(total * (1 - yesRatio) * 0.8),
        drepAbstainVotePower: Math.round(total * (1 - yesRatio) * 0.2),
      }),
    );
  }

  // Create DReps with varied voting patterns
  const drepVotes = new Map<string, VoteData[]>();
  const voteChoices: Array<'Yes' | 'No' | 'Abstain'> = ['Yes', 'No', 'Abstain'];

  for (let d = 0; d < drepCount; d++) {
    const drepId = `drep1_d${d}`;
    // Each DRep votes on 60-100% of proposals
    const voteFraction = 0.6 + (d / drepCount) * 0.4;
    const votes: VoteData[] = [];

    for (let p = 0; p < proposalCount; p++) {
      if (Math.random() > voteFraction) continue;
      const proposal = proposals[p];

      votes.push(
        makeVoteData({
          drepId,
          proposalKey: proposal.proposalKey,
          vote: voteChoices[Math.floor(Math.random() * 3)],
          blockTime: proposal.blockTime + ONE_DAY + Math.floor(Math.random() * 3 * ONE_DAY),
          proposalBlockTime: proposal.blockTime,
          proposalType: proposal.proposalType,
          rationaleQuality: Math.random() > 0.3 ? Math.floor(30 + Math.random() * 70) : null,
          importanceWeight: proposal.importanceWeight,
        }),
      );
    }

    drepVotes.set(drepId, votes);
  }

  return {
    proposals,
    allProposalTypes,
    votingSummaries,
    drepVotes,
    allProposals: new Map(proposals.map((p) => [p.proposalKey, p])),
  };
}
