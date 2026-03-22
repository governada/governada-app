/**
 * SPO Score V3.2 Sensitivity Analysis
 *
 * Tests weight stability by varying each pillar weight by +/-10% and measuring
 * rank correlation, tier changes, and maximum score deltas across a synthetic
 * population of 50 SPOs.
 *
 * Run: npx tsx scripts/spo-sensitivity-analysis.ts
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
import { computeTierWithCap, type TierName } from '../lib/scoring/tiers';
import { SPO_PILLAR_WEIGHTS, SPO_PILLAR_CALIBRATION, calibrate } from '../lib/scoring/calibration';

// ---------------------------------------------------------------------------
// Synthetic data generation
// ---------------------------------------------------------------------------

const CURRENT_EPOCH = 520;
const PROPOSAL_TYPES = [
  'TreasuryWithdrawals',
  'ParameterChange',
  'HardForkInitiation',
  'NoConfidence',
];
const ALL_PROPOSAL_TYPES = new Set(PROPOSAL_TYPES);

// Seeded pseudo-random number generator (deterministic)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);

interface SyntheticProposal {
  key: string;
  type: string;
  epoch: number;
  blockTime: number;
  proposalBlockTime: number;
  importanceWeight: number;
}

function generateProposals(count: number): SyntheticProposal[] {
  const proposals: SyntheticProposal[] = [];
  const baseTime = 1700000000;
  const typeWeights = [
    { type: 'TreasuryWithdrawals', weight: 0.6 },
    { type: 'ParameterChange', weight: 0.2 },
    { type: 'HardForkInitiation', weight: 0.1 },
    { type: 'NoConfidence', weight: 0.1 },
  ];

  for (let i = 0; i < count; i++) {
    const epoch = 510 + Math.floor(i / 3);
    const blockTime = baseTime + epoch * 432000 + i * 5000;
    // Pick type by weighted random
    const r = rng();
    let cumulative = 0;
    let type = 'TreasuryWithdrawals';
    for (const tw of typeWeights) {
      cumulative += tw.weight;
      if (r < cumulative) {
        type = tw.type;
        break;
      }
    }
    const importanceWeight =
      type === 'HardForkInitiation' || type === 'NoConfidence'
        ? 3
        : type === 'ParameterChange'
          ? 2
          : 1;

    proposals.push({
      key: `prop_${i}`,
      type,
      epoch,
      blockTime,
      proposalBlockTime: blockTime - 86400,
      importanceWeight,
    });
  }
  return proposals;
}

const PROPOSALS = generateProposals(25); // 25 proposals
const ACTIVE_EPOCHS = new Set(PROPOSALS.map((p) => p.epoch));
const TOTAL_PROPOSAL_POOL = PROPOSALS.reduce((sum, p) => sum + p.importanceWeight, 0);

// Default majority for dissent calculation
const MAJORITY_VOTES = new Map<string, 'Yes' | 'No' | null>();
for (const p of PROPOSALS) {
  MAJORITY_VOTES.set(p.key, 'Yes');
}

// ---------------------------------------------------------------------------
// Generate 50 synthetic SPOs with varied profiles
// ---------------------------------------------------------------------------

interface SyntheticSpo {
  poolId: string;
  archetype: string;
  votes: SpoVoteDataV3[];
  profile: SpoProfileData;
}

function generateSpos(): SyntheticSpo[] {
  const spos: SyntheticSpo[] = [];

  // 5 archetypes x 10 each = 50 SPOs
  const archetypes = [
    { name: 'high-participation', voteRate: 0.9, yesBias: 0.6, hasMetadata: true },
    { name: 'low-participation', voteRate: 0.2, yesBias: 0.7, hasMetadata: true },
    { name: 'high-deliberation', voteRate: 0.7, yesBias: 0.5, hasMetadata: true },
    { name: 'metadata-heavy', voteRate: 0.3, yesBias: 0.8, hasMetadata: true },
    { name: 'balanced', voteRate: 0.6, yesBias: 0.65, hasMetadata: true },
  ];

  let idx = 0;
  for (const arch of archetypes) {
    for (let j = 0; j < 10; j++) {
      const poolId = `pool_${idx}`;
      // Add some variance within archetype
      const voteRate = Math.max(0.05, Math.min(1, arch.voteRate + (rng() - 0.5) * 0.3));
      const yesBias = Math.max(0.1, Math.min(0.95, arch.yesBias + (rng() - 0.5) * 0.3));

      const votes: SpoVoteDataV3[] = [];
      for (const p of PROPOSALS) {
        if (rng() > voteRate) continue; // skip this proposal
        const r = rng();
        let vote: 'Yes' | 'No' | 'Abstain';
        if (r < yesBias) vote = 'Yes';
        else if (r < yesBias + (1 - yesBias) * 0.7) vote = 'No';
        else vote = 'Abstain';

        votes.push({
          poolId,
          proposalKey: p.key,
          vote,
          blockTime: p.blockTime + 3600,
          epoch: p.epoch,
          proposalType: p.type,
          importanceWeight: p.importanceWeight,
          proposalBlockTime: p.proposalBlockTime,
          hasRationale: false,
        });
      }

      const voteCount = votes.length;
      const hasSocial = rng() > 0.3;
      const hasStatement = arch.hasMetadata && rng() > 0.2;

      const profile: SpoProfileData = {
        poolId,
        ticker: `SP${idx}`,
        poolName: `Synthetic Pool ${idx}`,
        governanceStatement: hasStatement
          ? 'We are committed to transparent governance and vote on all proposals. ' +
            'Our pool prioritizes accountability, decentralization, and community engagement ' +
            'in the Cardano treasury and constitutional process.'
          : null,
        poolDescription:
          'A reliable stake pool operator contributing to the Cardano network since genesis.',
        homepageUrl: rng() > 0.3 ? 'https://pool.example.com' : null,
        socialLinks: hasSocial
          ? [
              { uri: 'https://twitter.com/pool', label: 'Twitter' },
              { uri: 'https://github.com/pool', label: 'GitHub' },
            ]
          : [],
        metadataHashVerified: rng() > 0.4,
        delegatorCount: Math.floor(rng() * 200),
        voteCount,
      };

      spos.push({ poolId, archetype: arch.name, votes, profile });
      idx++;
    }
  }

  return spos;
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

interface SpoScoreEntry {
  poolId: string;
  composite: number;
  tier: TierName;
  pCal: number;
  dCal: number;
  rCal: number;
  giCal: number;
}

/**
 * Score all SPOs using given pillar weights (overriding the defaults).
 * We re-compute pillar calibrated scores and combine with custom weights.
 */
function scoreAllSpos(
  spos: SyntheticSpo[],
  weights: {
    participation: number;
    deliberation: number;
    reliability: number;
    governanceIdentity: number;
  },
): SpoScoreEntry[] {
  // Aggregate all votes for margin computation
  const allVotes: SpoVoteDataV3[] = [];
  for (const spo of spos) allVotes.push(...spo.votes);
  const marginMultipliers = computeProposalMarginMultipliers(allVotes);

  // First compute pillar scores using real functions (with default weights internally)
  const baseResults = computeSpoScores(
    allVotes,
    TOTAL_PROPOSAL_POOL,
    CURRENT_EPOCH,
    ALL_PROPOSAL_TYPES,
    computeIdentityScores(spos),
    computeDeliberationScores(spos),
    computeConfidences(spos),
    new Map(),
    marginMultipliers,
    ACTIVE_EPOCHS,
  );

  // Re-combine calibrated pillars with custom weights
  const entries: SpoScoreEntry[] = [];
  for (const spo of spos) {
    const base = baseResults.get(spo.poolId);
    if (!base) continue;

    const composite = Math.round(
      weights.participation * base.participationCalibrated +
        weights.deliberation * base.deliberationCalibrated +
        weights.reliability * base.reliabilityCalibrated +
        weights.governanceIdentity * base.governanceIdentityCalibrated,
    );
    const clamped = Math.max(0, Math.min(100, composite));

    const tierCap = getSpoTierCap(spo.votes.length);
    const tier = computeTierWithCap(clamped, tierCap);

    entries.push({
      poolId: spo.poolId,
      composite: clamped,
      tier,
      pCal: base.participationCalibrated,
      dCal: base.deliberationCalibrated,
      rCal: base.reliabilityCalibrated,
      giCal: base.governanceIdentityCalibrated,
    });
  }

  return entries;
}

function computeIdentityScores(spos: SyntheticSpo[]): Map<string, number> {
  const profiles = new Map<string, SpoProfileData>();
  for (const spo of spos) profiles.set(spo.poolId, spo.profile);
  return computeSpoGovernanceIdentity(profiles);
}

function computeDeliberationScores(spos: SyntheticSpo[]): Map<string, number> {
  const poolVotes = new Map<string, SpoDeliberationVoteData[]>();
  for (const spo of spos) {
    const dVotes: SpoDeliberationVoteData[] = spo.votes.map((v) => ({
      proposalKey: v.proposalKey,
      vote: v.vote,
      blockTime: v.blockTime,
      proposalBlockTime: v.proposalBlockTime,
      proposalType: v.proposalType,
      importanceWeight: v.importanceWeight,
      hasRationale: v.hasRationale,
      spoMajorityVote: MAJORITY_VOTES.get(v.proposalKey) ?? null,
    }));
    poolVotes.set(spo.poolId, dVotes);
  }
  const maxTime = Math.max(...spos.flatMap((s) => s.votes.map((v) => v.blockTime)), 0);
  return computeSpoDeliberationQuality(poolVotes, ALL_PROPOSAL_TYPES, maxTime);
}

function computeConfidences(spos: SyntheticSpo[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const spo of spos) {
    const votedTypes = new Set(spo.votes.map((v) => v.proposalType));
    const typeCoverage =
      ALL_PROPOSAL_TYPES.size > 0 ? votedTypes.size / ALL_PROPOSAL_TYPES.size : 0;
    const epochs = spo.votes.map((v) => v.epoch);
    const epochSpan = epochs.length > 0 ? Math.max(...epochs) - Math.min(...epochs) : 0;
    m.set(spo.poolId, computeConfidence(spo.votes.length, epochSpan, typeCoverage));
  }
  return m;
}

// ---------------------------------------------------------------------------
// Spearman rank correlation
// ---------------------------------------------------------------------------

function spearmanRankCorrelation(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2) return 1;

  function rank(arr: number[]): number[] {
    const indexed = arr.map((v, i) => ({ v, i }));
    indexed.sort((x, y) => x.v - y.v);
    const ranks = new Array(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j < n && indexed[j].v === indexed[i].v) j++;
      const avgRank = (i + j - 1) / 2 + 1;
      for (let k = i; k < j; k++) ranks[indexed[k].i] = avgRank;
      i = j;
    }
    return ranks;
  }

  const rankA = rank(a);
  const rankB = rank(b);

  let sumD2 = 0;
  for (let i = 0; i < n; i++) {
    const d = rankA[i] - rankB[i];
    sumD2 += d * d;
  }

  return 1 - (6 * sumD2) / (n * (n * n - 1));
}

// ---------------------------------------------------------------------------
// Run analysis
// ---------------------------------------------------------------------------

function run() {
  console.log('=== SPO Score V3.2 Sensitivity Analysis ===\n');

  const spos = generateSpos();
  console.log(`Synthetic population: ${spos.length} SPOs`);
  console.log(`Proposal universe: ${PROPOSALS.length} proposals`);
  console.log(`Weight variation: +/-10%\n`);

  // Baseline scores
  const baselineWeights = { ...SPO_PILLAR_WEIGHTS };
  const baseline = scoreAllSpos(spos, baselineWeights);

  // Sort baseline by composite for top-50 rank extraction
  const baselineRanked = [...baseline].sort((a, b) => b.composite - a.composite);
  const baselineComposites = baselineRanked.map((e) => e.composite);
  const baselinePoolOrder = baselineRanked.map((e) => e.poolId);

  // Print baseline distribution
  const tierCounts: Record<string, number> = {};
  for (const e of baseline) {
    tierCounts[e.tier] = (tierCounts[e.tier] || 0) + 1;
  }
  console.log('Baseline tier distribution:');
  for (const [tier, count] of Object.entries(tierCounts).sort()) {
    console.log(`  ${tier.padEnd(12)} ${count}`);
  }
  console.log();

  // Vary each pillar weight by +/-10%
  type PillarKey = keyof typeof SPO_PILLAR_WEIGHTS;
  const pillars: PillarKey[] = [
    'participation',
    'deliberation',
    'reliability',
    'governanceIdentity',
  ];

  const results: Array<{
    pillar: string;
    rankCorr: number;
    tierChanges: number;
    maxDelta: number;
  }> = [];

  for (const pillar of pillars) {
    let worstRankCorr = 1;
    let maxTierChanges = 0;
    let maxScoreDelta = 0;

    for (const direction of [0.1, -0.1]) {
      // Vary this pillar's weight
      const varied = { ...baselineWeights };
      const shift = baselineWeights[pillar] * direction;
      varied[pillar] = baselineWeights[pillar] + shift;

      // Redistribute to other pillars proportionally
      const otherPillars = pillars.filter((p) => p !== pillar);
      const otherSum = otherPillars.reduce((s, p) => s + baselineWeights[p], 0);
      for (const op of otherPillars) {
        varied[op] = baselineWeights[op] - shift * (baselineWeights[op] / otherSum);
      }

      // Verify weights sum to ~1.0
      const sum = pillars.reduce((s, p) => s + varied[p], 0);
      if (Math.abs(sum - 1.0) > 0.001) {
        console.error(`Weight sum error: ${sum} for ${pillar} ${direction > 0 ? '+' : '-'}10%`);
        continue;
      }

      const variedScores = scoreAllSpos(spos, varied);

      // Rank correlation (use all 50)
      const variedRanked = [...variedScores].sort((a, b) => b.composite - a.composite);
      // Get composites in baseline pool order for correlation
      const variedByPool = new Map(variedScores.map((e) => [e.poolId, e]));
      const variedComposites = baselinePoolOrder.map(
        (pid) => variedByPool.get(pid)?.composite ?? 0,
      );

      const rankCorr = spearmanRankCorrelation(baselineComposites, variedComposites);
      if (rankCorr < worstRankCorr) worstRankCorr = rankCorr;

      // Tier changes
      let tierChanges = 0;
      for (const be of baseline) {
        const ve = variedScores.find((v) => v.poolId === be.poolId);
        if (ve && ve.tier !== be.tier) tierChanges++;
      }
      if (tierChanges > maxTierChanges) maxTierChanges = tierChanges;

      // Max score delta
      for (const be of baseline) {
        const ve = variedScores.find((v) => v.poolId === be.poolId);
        if (ve) {
          const delta = Math.abs(ve.composite - be.composite);
          if (delta > maxScoreDelta) maxScoreDelta = delta;
        }
      }
    }

    results.push({
      pillar,
      rankCorr: worstRankCorr,
      tierChanges: maxTierChanges,
      maxDelta: maxScoreDelta,
    });
  }

  // Print stability matrix
  console.log('─'.repeat(72));
  console.log(
    '\n' +
      'Pillar'.padEnd(24) +
      '| ' +
      'Rank Corr'.padEnd(12) +
      '| ' +
      'Tier Changes'.padEnd(14) +
      '| ' +
      'Max Delta',
  );
  console.log('─'.repeat(24) + '+' + '─'.repeat(13) + '+' + '─'.repeat(15) + '+' + '─'.repeat(10));

  for (const r of results) {
    const pillarLabel = `${r.pillar} ±10%`;
    console.log(
      pillarLabel.padEnd(24) +
        '| ' +
        r.rankCorr.toFixed(4).padStart(10) +
        '  | ' +
        String(r.tierChanges).padStart(10) +
        '    | ' +
        r.maxDelta.toFixed(1).padStart(7),
    );
  }

  console.log();

  // Overall assessment
  const allStable = results.every((r) => r.rankCorr >= 0.95);
  const avgCorr = results.reduce((s, r) => s + r.rankCorr, 0) / results.length;
  const totalTierChanges = results.reduce((s, r) => s + r.tierChanges, 0);

  if (allStable) {
    console.log(
      `CONCLUSION: Rankings are stable under ±10% weight variation. ` +
        `Average rank correlation: ${avgCorr.toFixed(4)}. ` +
        `Total tier changes across all variations: ${totalTierChanges}.`,
    );
  } else {
    const unstable = results.filter((r) => r.rankCorr < 0.95);
    console.log(`WARNING: Some pillars show sensitivity under ±10% variation:`);
    for (const u of unstable) {
      console.log(
        `  ${u.pillar}: rank correlation ${u.rankCorr.toFixed(4)}, ${u.tierChanges} tier changes, max delta ${u.maxDelta.toFixed(1)}`,
      );
    }
    console.log(
      `\nAverage rank correlation: ${avgCorr.toFixed(4)}. Consider investigating weight sensitivity for flagged pillars.`,
    );
  }

  // Pillar contribution analysis
  console.log('\n' + '─'.repeat(72));
  console.log('\nPillar Score Distribution (calibrated, across 50 SPOs):');
  const pillarsToReport: Array<{ label: string; values: number[] }> = [
    { label: 'Participation', values: baseline.map((e) => e.pCal) },
    { label: 'Deliberation', values: baseline.map((e) => e.dCal) },
    { label: 'Reliability', values: baseline.map((e) => e.rCal) },
    { label: 'Identity', values: baseline.map((e) => e.giCal) },
    { label: 'Composite', values: baseline.map((e) => e.composite) },
  ];

  console.log(
    '  ' +
      'Pillar'.padEnd(16) +
      'Min'.padStart(6) +
      'P25'.padStart(6) +
      'Med'.padStart(6) +
      'P75'.padStart(6) +
      'Max'.padStart(6),
  );

  for (const p of pillarsToReport) {
    const sorted = [...p.values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    const med = sorted[Math.floor(sorted.length * 0.5)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];

    console.log(
      '  ' +
        p.label.padEnd(16) +
        String(min).padStart(6) +
        String(p25).padStart(6) +
        String(med).padStart(6) +
        String(p75).padStart(6) +
        String(max).padStart(6),
    );
  }
}

run();
