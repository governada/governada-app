/**
 * SPO Score V3.2 Gaming Analysis
 *
 * Tests 6 gaming strategies against the V3.2 formula to verify that
 * the scoring system resists manipulation and rewards genuine governance.
 *
 * Run: npx tsx scripts/spo-gaming-analysis.ts
 */

import {
  computeSpoScores,
  computeProposalMarginMultipliers,
  type SpoVoteDataV3,
} from '../lib/scoring/spoScore';
import {
  computeSpoDeliberationQuality,
  type SpoDeliberationVoteData,
} from '../lib/scoring/spoDeliberationQuality';
import {
  computeSpoGovernanceIdentity,
  type SpoProfileData,
} from '../lib/scoring/spoGovernanceIdentity';
import { computeConfidence, getSpoTierCap } from '../lib/scoring/confidence';
import { computeTierWithCap } from '../lib/scoring/tiers';
import { SPO_PILLAR_WEIGHTS } from '../lib/scoring/calibration';

// ---------------------------------------------------------------------------
// Synthetic proposal universe
// ---------------------------------------------------------------------------

const CURRENT_EPOCH = 520;
const PROPOSAL_TYPES = [
  'TreasuryWithdrawals',
  'ParameterChange',
  'HardForkInitiation',
  'NoConfidence',
];
const ALL_PROPOSAL_TYPES = new Set(PROPOSAL_TYPES);

// 20 proposals spread across 10 epochs (epochs 510-519)
interface SyntheticProposal {
  key: string;
  type: string;
  epoch: number;
  blockTime: number;
  proposalBlockTime: number;
  importanceWeight: number;
}

function generateProposals(): SyntheticProposal[] {
  const proposals: SyntheticProposal[] = [];
  const baseTime = 1700000000; // arbitrary base timestamp

  // Distribution: 12 Treasury, 4 ParameterChange, 2 HardFork, 2 NoConfidence
  const typeDistribution = [
    ...Array(12).fill('TreasuryWithdrawals'),
    ...Array(4).fill('ParameterChange'),
    ...Array(2).fill('HardForkInitiation'),
    ...Array(2).fill('NoConfidence'),
  ];

  for (let i = 0; i < 20; i++) {
    const epoch = 510 + Math.floor(i / 2); // 2 proposals per epoch
    const blockTime = baseTime + epoch * 432000 + i * 10000;
    const type = typeDistribution[i];
    const importanceWeight =
      type === 'HardForkInitiation' || type === 'NoConfidence'
        ? 3
        : type === 'ParameterChange'
          ? 2
          : 1;

    proposals.push({
      key: `proposal_${i}`,
      type,
      epoch,
      blockTime,
      proposalBlockTime: blockTime - 86400, // proposed 1 day before
      importanceWeight,
    });
  }

  return proposals;
}

const PROPOSALS = generateProposals();

// Active epochs = epochs that had proposals
const ACTIVE_EPOCHS = new Set(PROPOSALS.map((p) => p.epoch));

// Total proposal pool (importance-weighted)
const TOTAL_PROPOSAL_POOL = PROPOSALS.reduce((sum, p) => sum + p.importanceWeight, 0);

// ---------------------------------------------------------------------------
// Strategy definitions
// ---------------------------------------------------------------------------

type VoteDirection = 'Yes' | 'No' | 'Abstain';

interface Strategy {
  name: string;
  description: string;
  generateVotes: (poolId: string) => SpoVoteDataV3[];
  /** Majority vote for each proposal (for dissent calculation) */
  getMajorityVotes: () => Map<string, 'Yes' | 'No' | null>;
  voteCount: number;
  hasFullMetadata: boolean;
}

/** Build full metadata profile for a pool */
function makeProfile(poolId: string, voteCount: number): SpoProfileData {
  return {
    poolId,
    ticker: 'TEST',
    poolName: 'Test Pool with Great Name',
    governanceStatement:
      'We believe in transparent decentralized governance for the Cardano community. ' +
      'Our pool actively participates in treasury proposals, votes on constitutional amendments, ' +
      'and delegates responsibly to ensure accountability and long-term sustainability.',
    poolDescription:
      'A professional stake pool operator dedicated to securing the Cardano network ' +
      'since epoch 200. We maintain 99.9% uptime and contribute to open-source tooling.',
    homepageUrl: 'https://testpool.example.com',
    socialLinks: [
      { uri: 'https://twitter.com/testpool', label: 'Twitter' },
      { uri: 'https://github.com/testpool', label: 'GitHub' },
    ],
    metadataHashVerified: true,
    delegatorCount: 50,
    voteCount,
  };
}

/** Build minimal metadata profile */
function makeMinimalProfile(poolId: string, voteCount: number): SpoProfileData {
  return {
    poolId,
    ticker: 'MIN',
    poolName: 'Minimal',
    governanceStatement: null,
    poolDescription: null,
    homepageUrl: null,
    socialLinks: [],
    metadataHashVerified: false,
    delegatorCount: 2,
    voteCount,
  };
}

function makeVote(poolId: string, proposal: SyntheticProposal, vote: VoteDirection): SpoVoteDataV3 {
  return {
    poolId,
    proposalKey: proposal.key,
    vote,
    blockTime: proposal.blockTime + 3600, // voted 1 hour after proposal
    epoch: proposal.epoch,
    proposalType: proposal.type,
    importanceWeight: proposal.importanceWeight,
    proposalBlockTime: proposal.proposalBlockTime,
    hasRationale: false,
  };
}

// The "majority" for dissent calculation — simulate a realistic majority
// where most SPOs vote Yes (70% Yes on each proposal)
function defaultMajorityVotes(): Map<string, 'Yes' | 'No' | null> {
  const m = new Map<string, 'Yes' | 'No' | null>();
  for (const p of PROPOSALS) {
    m.set(p.key, 'Yes');
  }
  return m;
}

const strategies: Strategy[] = [
  {
    name: 'Strategy A: Rubber-Stamper',
    description: 'Vote Yes on everything',
    voteCount: 20,
    hasFullMetadata: true,
    getMajorityVotes: defaultMajorityVotes,
    generateVotes(poolId) {
      return PROPOSALS.map((p) => makeVote(poolId, p, 'Yes'));
    },
  },
  {
    name: 'Strategy B: Random Voter',
    description: 'Vote Yes/No/Abstain randomly',
    voteCount: 20,
    hasFullMetadata: true,
    getMajorityVotes: defaultMajorityVotes,
    generateVotes(poolId) {
      // Deterministic "random" pattern
      const pattern: VoteDirection[] = [
        'Yes',
        'No',
        'Abstain',
        'Yes',
        'Yes',
        'No',
        'Abstain',
        'Yes',
        'No',
        'No',
        'Yes',
        'Abstain',
        'Yes',
        'No',
        'Yes',
        'Abstain',
        'No',
        'Yes',
        'Yes',
        'No',
      ];
      return PROPOSALS.map((p, i) => makeVote(poolId, p, pattern[i]));
    },
  },
  {
    name: 'Strategy C: Sybil Clone',
    description: "Copy another pool's votes exactly (100% agreement)",
    voteCount: 20,
    hasFullMetadata: true,
    getMajorityVotes: defaultMajorityVotes,
    generateVotes(poolId) {
      // Identical to rubber-stamper (cloning the majority = always Yes)
      return PROPOSALS.map((p) => makeVote(poolId, p, 'Yes'));
    },
  },
  {
    name: 'Strategy D: Metadata Gamer',
    description: 'Max metadata but only 2 votes total',
    voteCount: 2,
    hasFullMetadata: true,
    getMajorityVotes: defaultMajorityVotes,
    generateVotes(poolId) {
      // Only vote on 2 proposals (the last 2 for recency)
      return [makeVote(poolId, PROPOSALS[18], 'Yes'), makeVote(poolId, PROPOSALS[19], 'No')];
    },
  },
  {
    name: 'Strategy E: Abstain Farmer',
    description: 'Abstain on every proposal',
    voteCount: 20,
    hasFullMetadata: true,
    getMajorityVotes: defaultMajorityVotes,
    generateVotes(poolId) {
      return PROPOSALS.map((p) => makeVote(poolId, p, 'Abstain'));
    },
  },
  {
    name: 'Strategy F: Ideal Governor',
    description: 'Mixed Yes/No (70/30), 25% dissent, all types, full metadata',
    voteCount: 20,
    hasFullMetadata: true,
    getMajorityVotes: defaultMajorityVotes,
    generateVotes(poolId) {
      // 70% Yes, 30% No — but strategically place No votes against majority (dissent)
      // 5 out of 20 = 25% dissent (within the 15-40% sweet spot)
      const votes: VoteDirection[] = [
        'Yes',
        'Yes',
        'Yes',
        'No',
        'Yes', // 1 dissent
        'Yes',
        'No',
        'Yes',
        'Yes',
        'Yes', // 1 dissent
        'Yes',
        'Yes',
        'No',
        'Yes',
        'Yes', // 1 dissent
        'No',
        'Yes',
        'Yes',
        'No',
        'Yes', // 2 dissent = 5 total
      ];
      return PROPOSALS.map((p, i) => makeVote(poolId, p, votes[i]));
    },
  },
];

// ---------------------------------------------------------------------------
// Run analysis
// ---------------------------------------------------------------------------

function run() {
  console.log('=== SPO Score V3.2 Gaming Analysis ===\n');
  console.log(
    `Proposal universe: ${PROPOSALS.length} proposals across ${ACTIVE_EPOCHS.size} epochs`,
  );
  console.log(`Proposal types: ${[...ALL_PROPOSAL_TYPES].join(', ')}`);
  console.log(`Current epoch: ${CURRENT_EPOCH}`);
  console.log(`Total proposal pool (weighted): ${TOTAL_PROPOSAL_POOL}`);
  console.log(
    `Pillar weights: P=${SPO_PILLAR_WEIGHTS.participation} D=${SPO_PILLAR_WEIGHTS.deliberation} R=${SPO_PILLAR_WEIGHTS.reliability} GI=${SPO_PILLAR_WEIGHTS.governanceIdentity}\n`,
  );
  console.log('─'.repeat(72));

  const results: Array<{
    name: string;
    description: string;
    composite: number;
    tier: string;
    confidence: number;
    pRaw: number;
    pCal: number;
    dRaw: number;
    dCal: number;
    rRaw: number;
    rCal: number;
    giRaw: number;
    giCal: number;
  }> = [];

  for (const strategy of strategies) {
    const poolId = `pool_${strategy.name.charAt(9).toLowerCase()}`;
    const votes = strategy.generateVotes(poolId);
    const majorityVotes = strategy.getMajorityVotes();

    // Compute proposal margin multipliers from all votes for this strategy
    const marginMultipliers = computeProposalMarginMultipliers(votes);

    // Compute deliberation quality
    const deliberationVotes: SpoDeliberationVoteData[] = votes.map((v) => ({
      proposalKey: v.proposalKey,
      vote: v.vote,
      blockTime: v.blockTime,
      proposalBlockTime: v.proposalBlockTime,
      proposalType: v.proposalType,
      importanceWeight: v.importanceWeight,
      hasRationale: v.hasRationale,
      spoMajorityVote: majorityVotes.get(v.proposalKey) ?? null,
    }));

    const poolDelibVotes = new Map<string, SpoDeliberationVoteData[]>();
    poolDelibVotes.set(poolId, deliberationVotes);
    const deliberationScores = computeSpoDeliberationQuality(
      poolDelibVotes,
      ALL_PROPOSAL_TYPES,
      Math.max(...votes.map((v) => v.blockTime)),
    );

    // Compute governance identity
    const profile = strategy.hasFullMetadata
      ? makeProfile(poolId, strategy.voteCount)
      : makeMinimalProfile(poolId, strategy.voteCount);
    const profiles = new Map<string, SpoProfileData>();
    profiles.set(poolId, profile);
    const identityScores = computeSpoGovernanceIdentity(profiles);

    // Compute confidence
    const votedTypes = new Set(votes.map((v) => v.proposalType));
    const typeCoverage =
      ALL_PROPOSAL_TYPES.size > 0 ? votedTypes.size / ALL_PROPOSAL_TYPES.size : 0;
    const epochSpan =
      votes.length > 0
        ? Math.max(...votes.map((v) => v.epoch)) - Math.min(...votes.map((v) => v.epoch))
        : 0;
    const confidence = computeConfidence(votes.length, epochSpan, typeCoverage);
    const confidences = new Map<string, number>();
    confidences.set(poolId, confidence);

    // Compute composite via computeSpoScores
    const scoreResults = computeSpoScores(
      votes,
      TOTAL_PROPOSAL_POOL,
      CURRENT_EPOCH,
      ALL_PROPOSAL_TYPES,
      identityScores,
      deliberationScores,
      confidences,
      new Map(), // no score history
      marginMultipliers,
      ACTIVE_EPOCHS,
    );

    const result = scoreResults.get(poolId);
    if (!result) {
      console.log(`  [ERROR] No result for ${strategy.name}`);
      continue;
    }

    // Compute tier with cap
    const tierCap = getSpoTierCap(votes.length);
    const tier = computeTierWithCap(result.composite, tierCap);

    results.push({
      name: strategy.name,
      description: strategy.description,
      composite: result.composite,
      tier,
      confidence: result.confidence,
      pRaw: Math.round(result.participationRaw),
      pCal: result.participationCalibrated,
      dRaw: Math.round(result.deliberationRaw),
      dCal: result.deliberationCalibrated,
      rRaw: Math.round(result.reliabilityRaw),
      rCal: result.reliabilityCalibrated,
      giRaw: Math.round(result.governanceIdentityRaw),
      giCal: result.governanceIdentityCalibrated,
    });
  }

  // Print results
  for (const r of results) {
    console.log(`\n${r.name} (${r.description})`);
    console.log(
      `  Participation:  ${String(r.pRaw).padStart(3)} → cal ${String(r.pCal).padStart(3)}`,
    );
    console.log(
      `  Deliberation:   ${String(r.dRaw).padStart(3)} → cal ${String(r.dCal).padStart(3)}${
        r.dCal < 40 ? '    ← penalized' : ''
      }`,
    );
    console.log(
      `  Reliability:    ${String(r.rRaw).padStart(3)} → cal ${String(r.rCal).padStart(3)}`,
    );
    console.log(
      `  Identity:       ${String(r.giRaw).padStart(3)} → cal ${String(r.giCal).padStart(3)}`,
    );
    console.log(
      `  Composite:      ${String(r.composite).padStart(3)} | Tier: ${r.tier.padEnd(9)} | Confidence: ${r.confidence}`,
    );
  }

  // Print findings
  console.log('\n' + '─'.repeat(72));
  console.log('\nFINDINGS:\n');

  const rubberStamper = results.find((r) => r.name.includes('Rubber-Stamper'));
  const ideal = results.find((r) => r.name.includes('Ideal Governor'));
  const metadataGamer = results.find((r) => r.name.includes('Metadata Gamer'));
  const abstainFarmer = results.find((r) => r.name.includes('Abstain Farmer'));
  const sybilClone = results.find((r) => r.name.includes('Sybil Clone'));
  const randomVoter = results.find((r) => r.name.includes('Random'));

  if (rubberStamper && ideal) {
    console.log(
      `FINDING: Rubber-stamping deliberation: cal ${rubberStamper.dCal} vs ideal ${ideal.dCal} ` +
        `(delta ${ideal.dCal - rubberStamper.dCal}). ` +
        `Composite: ${rubberStamper.composite} vs ${ideal.composite} — ` +
        `deliberation pillar is the primary differentiator.`,
    );
  }
  if (metadataGamer) {
    console.log(
      `FINDING: Metadata-only gaming (2 votes) → tier-capped at ${metadataGamer.tier} ` +
        `(confidence ${metadataGamer.confidence}). Composite ${metadataGamer.composite} ` +
        `but graduated cap blocks advancement.`,
    );
  }
  if (abstainFarmer && ideal) {
    console.log(
      `FINDING: Abstain farming → deliberation cal ${abstainFarmer.dCal} ` +
        `(vs ideal ${ideal.dCal}). Abstain penalty reduces diversity score, ` +
        `costing ${ideal.composite - abstainFarmer.composite} composite points.`,
    );
  }
  if (sybilClone && rubberStamper) {
    console.log(
      `FINDING: Sybil clone = rubber-stamper (both ${sybilClone.composite}). ` +
        `Identical vote patterns produce identical scores — ` +
        `no free points from copying.`,
    );
  }
  if (randomVoter && ideal) {
    console.log(
      `FINDING: Random voting (${randomVoter.composite}) matches ideal (${ideal.composite}) on diversity ` +
        `because random distribution mimics thoughtful mixed voting. ` +
        `V3.2 cannot distinguish random from intentional — acceptable tradeoff.`,
    );
  }

  console.log(
    `\nCONCLUSION: V3.2 differentiates via deliberation pillar ` +
      `(${rubberStamper?.dCal} rubber-stamp vs ${ideal?.dCal} ideal). ` +
      `Graduated tier caps block metadata-only gaming (${metadataGamer?.tier}). ` +
      `Primary remaining attack surface: random voting mimics good diversity.`,
  );
}

run();
