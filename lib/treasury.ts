/**
 * Treasury Intelligence Library
 * Core functions for treasury balance, runway, health scoring,
 * accountability, and proposal similarity matching.
 */

import { getSupabaseAdmin, createClient } from '@/lib/supabase';

const LOVELACE_PER_ADA = 1_000_000;
const EPOCH_DAYS = 5;
const MONTHS_PER_EPOCH = EPOCH_DAYS / 30.44;
const HEALTHY_RUNWAY_MONTHS = 24;

// Treasury tier thresholds (ADA) — same as lib/alignment.ts
const TIER_ROUTINE_MAX = 1_000_000;
const TIER_SIGNIFICANT_MAX = 20_000_000;

// Accountability poll gating (epochs after enacted_epoch)
const ACCOUNTABILITY_DELAY_ROUTINE = 18; // ~3 months
const ACCOUNTABILITY_DELAY_SIGNIFICANT = 36; // ~6 months
const ACCOUNTABILITY_DELAY_MAJOR = 73; // ~12 months
const ACCOUNTABILITY_CYCLE_INTERVAL = 36; // ~6 months between re-evaluations
const ACCOUNTABILITY_POLL_DURATION = 6; // ~30 days open per cycle
const ROUTINE_MAX_CYCLES = 2; // routine: initial + 1 re-eval

export function lovelaceToAda(lovelace: bigint | number | string): number {
  return Number(BigInt(lovelace)) / LOVELACE_PER_ADA;
}

export function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(2)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toFixed(0);
}

// ---------------------------------------------------------------------------
// Treasury Balance & Runway
// ---------------------------------------------------------------------------

export interface TreasurySnapshot {
  epoch: number;
  balanceAda: number;
  withdrawalsAda: number;
  reservesIncomeAda: number;
  snapshotAt: string;
}

export async function getTreasuryBalance(): Promise<{
  balanceAda: number;
  epoch: number;
  snapshotAt: string;
} | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('treasury_snapshots')
    .select('epoch_no, balance_lovelace, snapshot_at')
    .order('epoch_no', { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;
  return {
    balanceAda: lovelaceToAda(data.balance_lovelace),
    epoch: data.epoch_no,
    snapshotAt: data.snapshot_at,
  };
}

export async function getTreasuryTrend(epochs = 30): Promise<TreasurySnapshot[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('treasury_snapshots')
    .select(
      'epoch_no, balance_lovelace, withdrawals_lovelace, reserves_income_lovelace, snapshot_at',
    )
    .order('epoch_no', { ascending: false })
    .limit(epochs);

  if (!data) return [];
  return data.reverse().map((row) => ({
    epoch: row.epoch_no,
    balanceAda: lovelaceToAda(row.balance_lovelace),
    withdrawalsAda: lovelaceToAda(row.withdrawals_lovelace || 0),
    reservesIncomeAda: lovelaceToAda(row.reserves_income_lovelace || 0),
    snapshotAt: row.snapshot_at,
  }));
}

export function calculateBurnRate(snapshots: TreasurySnapshot[], windowEpochs = 10): number {
  if (snapshots.length < 2) return 0;
  const recent = snapshots.slice(-windowEpochs);
  const totalWithdrawals = recent.reduce((sum, s) => sum + s.withdrawalsAda, 0);
  return totalWithdrawals / recent.length;
}

export function calculateRunwayMonths(balanceAda: number, burnRatePerEpoch: number): number {
  if (burnRatePerEpoch <= 0) return Infinity;
  const epochsRemaining = balanceAda / burnRatePerEpoch;
  return epochsRemaining * MONTHS_PER_EPOCH;
}

export interface IncomeVsOutflow {
  epoch: number;
  incomeAda: number;
  outflowAda: number;
  netAda: number;
}

export function getIncomeVsOutflow(snapshots: TreasurySnapshot[]): IncomeVsOutflow[] {
  return snapshots.map((s) => ({
    epoch: s.epoch,
    incomeAda: s.reservesIncomeAda,
    outflowAda: s.withdrawalsAda,
    netAda: s.reservesIncomeAda - s.withdrawalsAda,
  }));
}

// ---------------------------------------------------------------------------
// Treasury Health Score (0-100)
// ---------------------------------------------------------------------------

export interface TreasuryHealthScore {
  score: number;
  components: {
    balanceTrend: number;
    withdrawalVelocity: number;
    incomeStability: number;
    pendingLoad: number;
    runwayAdequacy: number;
  };
  runwayMonths: number;
  burnRatePerEpoch: number;
}

export async function calculateTreasuryHealthScore(): Promise<TreasuryHealthScore | null> {
  const snapshots = await getTreasuryTrend(30);
  if (snapshots.length < 5) return null;

  const current = snapshots[snapshots.length - 1];
  const burnRate = calculateBurnRate(snapshots, 10);
  const runwayMonths = calculateRunwayMonths(current.balanceAda, burnRate);

  // 1. Balance trend (0-100): is the treasury growing or shrinking?
  const balanceTrend = (() => {
    const first = snapshots[0].balanceAda;
    const last = current.balanceAda;
    const pctChange = ((last - first) / first) * 100;
    return Math.max(0, Math.min(100, 50 + pctChange * 5));
  })();

  // 2. Withdrawal velocity (0-100): is spending accelerating?
  const withdrawalVelocity = (() => {
    const halfIdx = Math.floor(snapshots.length / 2);
    const firstHalf = snapshots.slice(0, halfIdx);
    const secondHalf = snapshots.slice(halfIdx);
    const avgFirst = firstHalf.reduce((s, r) => s + r.withdrawalsAda, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, r) => s + r.withdrawalsAda, 0) / secondHalf.length;
    if (avgFirst === 0) return 80;
    const ratio = avgSecond / avgFirst;
    return Math.max(0, Math.min(100, 100 - (ratio - 1) * 50));
  })();

  // 3. Income stability (0-100): consistent reserve income?
  const incomeStability = (() => {
    const incomes = snapshots.map((s) => s.reservesIncomeAda).filter((i) => i > 0);
    if (incomes.length < 2) return 50;
    const mean = incomes.reduce((a, b) => a + b, 0) / incomes.length;
    const variance = incomes.reduce((s, v) => s + (v - mean) ** 2, 0) / incomes.length;
    const cv = Math.sqrt(variance) / (mean || 1);
    return Math.max(0, Math.min(100, 100 - cv * 100));
  })();

  // 4. Pending load (0-100): how much is pending vs balance?
  const pendingLoad = await (async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('proposals')
      .select('withdrawal_amount')
      .eq('proposal_type', 'TreasuryWithdrawals')
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('expired_epoch', null)
      .is('dropped_epoch', null);

    const totalPending = (data || []).reduce((sum, p) => sum + (p.withdrawal_amount || 0), 0);
    const pctOfBalance = (totalPending / (current.balanceAda || 1)) * 100;
    return Math.max(0, Math.min(100, 100 - pctOfBalance * 2));
  })();

  // 5. Runway adequacy (0-100): months remaining vs 24-month healthy baseline
  const runwayAdequacy = (() => {
    if (runwayMonths === Infinity) return 100;
    const ratio = runwayMonths / HEALTHY_RUNWAY_MONTHS;
    return Math.max(0, Math.min(100, ratio * 50 + 25));
  })();

  const score = Math.round(
    balanceTrend * 0.2 +
      withdrawalVelocity * 0.2 +
      incomeStability * 0.15 +
      pendingLoad * 0.2 +
      runwayAdequacy * 0.25,
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    components: {
      balanceTrend: Math.round(balanceTrend),
      withdrawalVelocity: Math.round(withdrawalVelocity),
      incomeStability: Math.round(incomeStability),
      pendingLoad: Math.round(pendingLoad),
      runwayAdequacy: Math.round(runwayAdequacy),
    },
    runwayMonths: runwayMonths === Infinity ? 999 : Math.round(runwayMonths),
    burnRatePerEpoch: Math.round(burnRate),
  };
}

// ---------------------------------------------------------------------------
// Pending Proposals Impact
// ---------------------------------------------------------------------------

export interface PendingProposal {
  txHash: string;
  index: number;
  title: string;
  withdrawalAda: number;
  pctOfBalance: number;
  treasuryTier: string | null;
  proposedEpoch: number;
}

export async function getPendingTreasuryProposals(
  currentBalanceAda: number,
): Promise<PendingProposal[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, title, withdrawal_amount, treasury_tier, proposed_epoch')
    .eq('proposal_type', 'TreasuryWithdrawals')
    .is('ratified_epoch', null)
    .is('enacted_epoch', null)
    .is('expired_epoch', null)
    .is('dropped_epoch', null)
    .order('withdrawal_amount', { ascending: false });

  if (!data) return [];
  return data.map((p) => ({
    txHash: p.tx_hash,
    index: p.proposal_index,
    title: p.title || 'Untitled Treasury Proposal',
    withdrawalAda: p.withdrawal_amount || 0,
    pctOfBalance:
      currentBalanceAda > 0 ? ((p.withdrawal_amount || 0) / currentBalanceAda) * 100 : 0,
    treasuryTier: p.treasury_tier,
    proposedEpoch: p.proposed_epoch,
  }));
}

// ---------------------------------------------------------------------------
// Runway Projections (multi-scenario)
// ---------------------------------------------------------------------------

export interface RunwayScenario {
  name: string;
  key: string;
  projectedMonths: number;
  depletionEpoch: number | null;
  balanceCurve: Array<{ epoch: number; balanceAda: number }>;
}

export function projectRunway(
  currentBalanceAda: number,
  burnRatePerEpoch: number,
  incomePerEpoch: number,
  currentEpoch: number,
  pendingTotalAda: number,
  projectionEpochs = 365,
): RunwayScenario[] {
  const scenarios: RunwayScenario[] = [];

  const simulate = (name: string, key: string, adjustedBurn: number, oneTimeDeduction: number) => {
    const curve: Array<{ epoch: number; balanceAda: number }> = [];
    let balance = currentBalanceAda - oneTimeDeduction;
    let depletionEpoch: number | null = null;

    for (let i = 0; i <= projectionEpochs; i++) {
      const epoch = currentEpoch + i;
      curve.push({ epoch, balanceAda: Math.max(0, balance) });
      if (balance <= 0 && !depletionEpoch) {
        depletionEpoch = epoch;
      }
      balance += incomePerEpoch - adjustedBurn;
    }

    const projectedMonths = depletionEpoch
      ? (depletionEpoch - currentEpoch) * MONTHS_PER_EPOCH
      : projectionEpochs * MONTHS_PER_EPOCH;

    scenarios.push({
      name,
      key,
      projectedMonths: Math.round(projectedMonths),
      depletionEpoch,
      balanceCurve: curve,
    });
  };

  simulate('Current Trajectory', 'conservative', burnRatePerEpoch, 0);
  simulate('Moderate Growth (+25%)', 'moderate', burnRatePerEpoch * 1.25, 0);
  simulate('All Pending Pass', 'aggressive', burnRatePerEpoch, pendingTotalAda);
  simulate('Spending Freeze', 'freeze', 0, 0);

  return scenarios;
}

// ---------------------------------------------------------------------------
// Counterfactual Analysis
// ---------------------------------------------------------------------------

export interface CounterfactualResult {
  totalWithdrawnAda: number;
  largestWithdrawals: Array<{ title: string; amountAda: number; epoch: number }>;
  hypotheticalBalanceAda: number;
  additionalRunwayMonths: number;
}

export async function getCounterfactualAnalysis(
  currentBalanceAda: number,
  burnRatePerEpoch: number,
): Promise<CounterfactualResult> {
  const supabase = createClient();
  const { data } = await supabase
    .from('proposals')
    .select('title, withdrawal_amount, enacted_epoch')
    .eq('proposal_type', 'TreasuryWithdrawals')
    .not('enacted_epoch', 'is', null)
    .order('withdrawal_amount', { ascending: false })
    .limit(10);

  const withdrawals = (data || []).map((p) => ({
    title: p.title || 'Untitled',
    amountAda: p.withdrawal_amount || 0,
    epoch: p.enacted_epoch,
  }));

  const totalWithdrawn = withdrawals.reduce((s, w) => s + w.amountAda, 0);
  const hypotheticalBalance = currentBalanceAda + totalWithdrawn;
  const currentRunway = calculateRunwayMonths(currentBalanceAda, burnRatePerEpoch);
  const hypotheticalRunway = calculateRunwayMonths(hypotheticalBalance, burnRatePerEpoch);

  return {
    totalWithdrawnAda: totalWithdrawn,
    largestWithdrawals: withdrawals.slice(0, 5),
    hypotheticalBalanceAda: hypotheticalBalance,
    additionalRunwayMonths: Math.round(
      (hypotheticalRunway === Infinity ? 999 : hypotheticalRunway) -
        (currentRunway === Infinity ? 999 : currentRunway),
    ),
  };
}

// ---------------------------------------------------------------------------
// Proposal Similarity Matching
// ---------------------------------------------------------------------------

export interface SimilarProposal {
  txHash: string;
  index: number;
  title: string;
  withdrawalAda: number;
  treasuryTier: string | null;
  outcome: 'enacted' | 'ratified' | 'expired' | 'dropped' | 'active';
  accountabilityRating: string | null;
  matchStrength: 'strong' | 'moderate' | 'weak';
}

export async function findSimilarProposals(
  proposalTitle: string,
  withdrawalAda: number,
  treasuryTier: string | null,
  excludeTxHash?: string,
): Promise<SimilarProposal[]> {
  const supabase = createClient();
  const { data: proposals } = await supabase
    .from('proposals')
    .select(
      'tx_hash, proposal_index, title, withdrawal_amount, treasury_tier, enacted_epoch, ratified_epoch, expired_epoch, dropped_epoch',
    )
    .eq('proposal_type', 'TreasuryWithdrawals')
    .order('proposed_epoch', { ascending: false })
    .limit(100);

  if (!proposals) return [];

  const titleWords = new Set(
    proposalTitle
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3),
  );

  return proposals
    .filter((p) => p.tx_hash !== excludeTxHash)
    .map((p) => {
      const pTitle = (p.title || '').toLowerCase();
      const pWords = new Set(pTitle.split(/\W+/).filter((w: string) => w.length > 3));
      const wordOverlap = [...titleWords].filter((w) => pWords.has(w)).length;
      const tierMatch = p.treasury_tier === treasuryTier;
      const amountRatio =
        withdrawalAda > 0 && p.withdrawal_amount > 0
          ? Math.min(withdrawalAda, p.withdrawal_amount) /
            Math.max(withdrawalAda, p.withdrawal_amount)
          : 0;

      let score = 0;
      if (tierMatch) score += 3;
      score += wordOverlap * 2;
      if (amountRatio > 0.5) score += 2;
      if (amountRatio > 0.8) score += 1;

      const matchStrength: 'strong' | 'moderate' | 'weak' =
        score >= 5 ? 'strong' : score >= 3 ? 'moderate' : 'weak';

      const outcome: SimilarProposal['outcome'] = p.enacted_epoch
        ? 'enacted'
        : p.ratified_epoch
          ? 'ratified'
          : p.expired_epoch
            ? 'expired'
            : p.dropped_epoch
              ? 'dropped'
              : 'active';

      return {
        txHash: p.tx_hash,
        index: p.proposal_index,
        title: p.title || 'Untitled',
        withdrawalAda: p.withdrawal_amount || 0,
        treasuryTier: p.treasury_tier,
        outcome,
        accountabilityRating: null,
        matchStrength,
        _score: score,
      };
    })
    .filter((p) => p._score >= 2)
    .sort((a, b) => b._score - a._score)
    .slice(0, 5)
    .map(({ _score, ...rest }) => rest);
}

// ---------------------------------------------------------------------------
// DRep Treasury Track Record
// ---------------------------------------------------------------------------

export interface DRepTreasuryRecord {
  totalProposals: number;
  totalAdaVotedOn: number;
  approvedCount: number;
  approvedAda: number;
  opposedCount: number;
  opposedAda: number;
  abstainedCount: number;
  accountabilityStats: {
    delivered: number;
    partial: number;
    notDelivered: number;
    pending: number;
  };
  judgmentScore: number | null;
}

export async function getDRepTreasuryTrackRecord(drepId: string): Promise<DRepTreasuryRecord> {
  const supabase = createClient();

  const { data: votes } = await supabase
    .from('drep_votes')
    .select('vote, proposal_tx_hash, proposal_index')
    .eq('drep_id', drepId);

  const { data: proposals } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, withdrawal_amount, enacted_epoch')
    .eq('proposal_type', 'TreasuryWithdrawals');

  if (!votes || !proposals) {
    return {
      totalProposals: 0,
      totalAdaVotedOn: 0,
      approvedCount: 0,
      approvedAda: 0,
      opposedCount: 0,
      opposedAda: 0,
      abstainedCount: 0,
      accountabilityStats: { delivered: 0, partial: 0, notDelivered: 0, pending: 0 },
      judgmentScore: null,
    };
  }

  const proposalMap = new Map(proposals.map((p) => [`${p.tx_hash}-${p.proposal_index}`, p]));
  let approvedCount = 0,
    opposedCount = 0,
    abstainedCount = 0;
  let approvedAda = 0,
    opposedAda = 0,
    totalAdaVotedOn = 0;
  const approvedEnacted: string[] = [];

  for (const v of votes) {
    const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
    const proposal = proposalMap.get(key);
    if (!proposal) continue;

    const ada = proposal.withdrawal_amount || 0;
    totalAdaVotedOn += ada;

    if (v.vote === 'Yes') {
      approvedCount++;
      approvedAda += ada;
      if (proposal.enacted_epoch) approvedEnacted.push(key);
    } else if (v.vote === 'No') {
      opposedCount++;
      opposedAda += ada;
    } else {
      abstainedCount++;
    }
  }

  // Fetch accountability ratings for proposals this DRep approved
  const accountabilityStats = { delivered: 0, partial: 0, notDelivered: 0, pending: 0 };
  if (approvedEnacted.length > 0) {
    const { data: polls } = await supabase
      .from('treasury_accountability_polls')
      .select('proposal_tx_hash, proposal_index, results_summary, status')
      .eq('status', 'closed');

    for (const key of approvedEnacted) {
      const [txHash, idx] = key.split('-');
      const poll = (polls || []).find(
        (p) => p.proposal_tx_hash === txHash && p.proposal_index === parseInt(idx),
      );
      if (!poll || !poll.results_summary) {
        accountabilityStats.pending++;
        continue;
      }
      const summary = poll.results_summary as Record<string, number>;
      const topRating = Object.entries(summary).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topRating === 'delivered') accountabilityStats.delivered++;
      else if (topRating === 'partial') accountabilityStats.partial++;
      else if (topRating === 'not_delivered') accountabilityStats.notDelivered++;
      else accountabilityStats.pending++;
    }
  }

  const rated =
    accountabilityStats.delivered + accountabilityStats.partial + accountabilityStats.notDelivered;
  const judgmentScore =
    rated > 0
      ? Math.round(
          ((accountabilityStats.delivered + accountabilityStats.partial * 0.5) / rated) * 100,
        )
      : null;

  return {
    totalProposals: approvedCount + opposedCount + abstainedCount,
    totalAdaVotedOn,
    approvedCount,
    approvedAda,
    opposedCount,
    opposedAda,
    abstainedCount,
    accountabilityStats,
    judgmentScore,
  };
}

// ---------------------------------------------------------------------------
// Spending Effectiveness
// ---------------------------------------------------------------------------

export interface SpendingEffectiveness {
  totalSpentAda: number;
  totalEnacted: number;
  ratingBreakdown: {
    delivered: number;
    partial: number;
    notDelivered: number;
    tooEarly: number;
    pendingReview: number;
  };
  effectivenessRate: number | null;
  topRated: Array<{ title: string; amountAda: number; rating: string }>;
  bottomRated: Array<{ title: string; amountAda: number; rating: string }>;
}

export async function getSpendingEffectiveness(): Promise<SpendingEffectiveness> {
  const supabase = createClient();

  const { data: enacted } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, title, withdrawal_amount')
    .eq('proposal_type', 'TreasuryWithdrawals')
    .not('enacted_epoch', 'is', null)
    .order('withdrawal_amount', { ascending: false });

  const { data: polls } = await supabase
    .from('treasury_accountability_polls')
    .select('proposal_tx_hash, proposal_index, results_summary, status')
    .eq('status', 'closed');

  const pollMap = new Map(
    (polls || []).map((p) => [`${p.proposal_tx_hash}-${p.proposal_index}`, p]),
  );

  const breakdown = { delivered: 0, partial: 0, notDelivered: 0, tooEarly: 0, pendingReview: 0 };
  const rated: Array<{ title: string; amountAda: number; rating: string }> = [];
  let totalSpent = 0;

  for (const p of enacted || []) {
    totalSpent += p.withdrawal_amount || 0;
    const poll = pollMap.get(`${p.tx_hash}-${p.proposal_index}`);
    if (!poll?.results_summary) {
      breakdown.pendingReview++;
      continue;
    }
    const summary = poll.results_summary as Record<string, number>;
    const topRating =
      Object.entries(summary).sort((a, b) => b[1] - a[1])[0]?.[0] || 'pendingReview';

    if (topRating === 'delivered') breakdown.delivered++;
    else if (topRating === 'partial') breakdown.partial++;
    else if (topRating === 'not_delivered') breakdown.notDelivered++;
    else if (topRating === 'too_early') breakdown.tooEarly++;
    else breakdown.pendingReview++;

    rated.push({
      title: p.title || 'Untitled',
      amountAda: p.withdrawal_amount || 0,
      rating: topRating,
    });
  }

  const assessedCount = breakdown.delivered + breakdown.partial + breakdown.notDelivered;
  const effectivenessRate =
    assessedCount > 0
      ? Math.round(((breakdown.delivered + breakdown.partial * 0.5) / assessedCount) * 100)
      : null;

  return {
    totalSpentAda: totalSpent,
    totalEnacted: (enacted || []).length,
    ratingBreakdown: breakdown,
    effectivenessRate,
    topRated: rated.filter((r) => r.rating === 'delivered').slice(0, 3),
    bottomRated: rated.filter((r) => r.rating === 'not_delivered').slice(0, 3),
  };
}

// ---------------------------------------------------------------------------
// Accountability Poll Scheduling
// ---------------------------------------------------------------------------

export function getAccountabilityDelay(treasuryTier: string | null): number {
  switch (treasuryTier) {
    case 'routine':
      return ACCOUNTABILITY_DELAY_ROUTINE;
    case 'significant':
      return ACCOUNTABILITY_DELAY_SIGNIFICANT;
    case 'major':
      return ACCOUNTABILITY_DELAY_MAJOR;
    default:
      return ACCOUNTABILITY_DELAY_SIGNIFICANT;
  }
}

export function getMaxCycles(treasuryTier: string | null): number | null {
  return treasuryTier === 'routine' ? ROUTINE_MAX_CYCLES : null;
}

export function getNextCycleEpoch(
  currentClosesEpoch: number,
  cycleNumber: number,
  treasuryTier: string | null,
): number | null {
  const maxCycles = getMaxCycles(treasuryTier);
  if (maxCycles && cycleNumber >= maxCycles) return null;
  return currentClosesEpoch + ACCOUNTABILITY_CYCLE_INTERVAL;
}

export { ACCOUNTABILITY_POLL_DURATION, ACCOUNTABILITY_CYCLE_INTERVAL };
