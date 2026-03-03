/**
 * Governance Health Index (GHI) — a single 0-100 number for Cardano ecosystem health.
 * The crypto equivalent of the Fear & Greed Index.
 *
 * Components:
 *   Participation Rate    (25%) — avg effective participation of active DReps
 *   Rationale Rate        (20%) — avg rationale rate of active DReps
 *   Delegation Spread     (15%) — inverse Gini of voting power (more spread = healthier)
 *   Proposal Throughput   (15%) — ratio of proposals with votes to total proposals
 *   DRep Diversity        (10%) — variety of alignment profiles among active DReps
 *   DRep Activity         (15%) — ratio of active DReps to total registered
 */

import { createClient } from './supabase';

export type GHIBand = 'critical' | 'fair' | 'good' | 'strong';

export interface GHIComponent {
  name: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface GHIResult {
  score: number;
  band: GHIBand;
  components: GHIComponent[];
}

function getBand(score: number): GHIBand {
  if (score >= 76) return 'strong';
  if (score >= 51) return 'good';
  if (score >= 26) return 'fair';
  return 'critical';
}

export const GHI_BAND_COLORS: Record<GHIBand, string> = {
  critical: '#ef4444',
  fair: '#f59e0b',
  good: '#06b6d4',
  strong: '#10b981',
};

export const GHI_BAND_LABELS: Record<GHIBand, string> = {
  critical: 'Critical',
  fair: 'Fair',
  good: 'Good',
  strong: 'Strong',
};

function computeGini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;

  let sumOfAbsDiffs = 0;
  for (let i = 0; i < n; i++) {
    sumOfAbsDiffs += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return sumOfAbsDiffs / (n * total);
}

export async function computeGHI(): Promise<GHIResult> {
  const supabase = createClient();

  const [drepsRes, proposalsRes, votesRes] = await Promise.all([
    supabase
      .from('dreps')
      .select(
        'id, effective_participation, rationale_rate, info, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
      ),
    supabase
      .from('proposals')
      .select(
        'tx_hash, proposal_index, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch',
      ),
    supabase
      .from('drep_votes')
      .select('proposal_tx_hash, proposal_index', { count: 'exact', head: false }),
  ]);

  const allDreps = drepsRes.data || [];
  const activeDreps = allDreps.filter((d: any) => d.info?.isActive);
  const proposals = proposalsRes.data || [];
  const votes = votesRes.data || [];

  // 1. Participation Rate (25%)
  const participationRates = activeDreps.map((d: any) => d.effective_participation || 0);
  const avgParticipation =
    participationRates.length > 0
      ? participationRates.reduce((a: number, b: number) => a + b, 0) / participationRates.length
      : 0;

  // 2. Rationale Rate (20%)
  const rationaleRates = activeDreps.map((d: any) => d.rationale_rate || 0);
  const avgRationale =
    rationaleRates.length > 0
      ? rationaleRates.reduce((a: number, b: number) => a + b, 0) / rationaleRates.length
      : 0;

  // 3. Delegation Spread (15%) — inverse Gini
  const votingPowers = activeDreps
    .map((d: any) => parseInt(d.info?.votingPowerLovelace || '0', 10))
    .filter((v: number) => v > 0);
  const gini = computeGini(votingPowers);
  const delegationSpread = Math.round((1 - gini) * 100);

  // 4. Proposal Throughput (15%) — proposals that received at least one vote
  const votedProposalKeys = new Set(
    votes.map((v: any) => `${v.proposal_tx_hash}-${v.proposal_index}`),
  );
  const totalProposals = proposals.length;
  const proposalThroughput =
    totalProposals > 0
      ? Math.min(100, Math.round((votedProposalKeys.size / totalProposals) * 100))
      : 0;

  // 5. DRep Diversity (10%) — unique alignment profiles
  const profiles = activeDreps.map((d: any) => {
    const dims = [
      d.alignment_treasury_conservative,
      d.alignment_treasury_growth,
      d.alignment_decentralization,
      d.alignment_security,
      d.alignment_innovation,
      d.alignment_transparency,
    ];
    return dims
      .map((v) => {
        if (v == null) return 'M';
        if (v >= 70) return 'H';
        if (v <= 30) return 'L';
        return 'M';
      })
      .join('');
  });
  const uniqueProfiles = new Set(profiles).size;
  const maxPossible = Math.min(activeDreps.length, 729); // 3^6
  const diversityScore =
    maxPossible > 0
      ? Math.min(100, Math.round((uniqueProfiles / Math.min(maxPossible, 50)) * 100))
      : 0;

  // 6. DRep Activity (15%) — active / total
  const activityRatio =
    allDreps.length > 0
      ? Math.min(100, Math.round((activeDreps.length / allDreps.length) * 100))
      : 0;

  const components: GHIComponent[] = [
    { name: 'Participation', value: Math.round(avgParticipation), weight: 0.25, contribution: 0 },
    { name: 'Rationale', value: Math.round(avgRationale), weight: 0.2, contribution: 0 },
    { name: 'Delegation Spread', value: delegationSpread, weight: 0.15, contribution: 0 },
    { name: 'Proposal Throughput', value: proposalThroughput, weight: 0.15, contribution: 0 },
    { name: 'DRep Diversity', value: diversityScore, weight: 0.1, contribution: 0 },
    { name: 'DRep Activity', value: activityRatio, weight: 0.15, contribution: 0 },
  ];

  components.forEach((c) => {
    c.contribution = Math.round(c.value * c.weight);
  });

  const score = Math.min(
    100,
    Math.max(
      0,
      components.reduce((s, c) => s + c.contribution, 0),
    ),
  );

  return {
    score,
    band: getBand(score),
    components,
  };
}
