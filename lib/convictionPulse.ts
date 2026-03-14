/**
 * Conviction Pulse — quantifies how deeply DReps care about a proposal.
 *
 * Conviction (0-100): How much effort went into this decision.
 *   30% rationale rate (did DReps explain themselves?)
 *   40% avg rationale quality (how good were the explanations?)
 *   30% power concentration (is there broad or narrow participation?)
 *
 * Polarization (0-100): How divided the community is.
 *   Complement of Herfindahl-Hirschman index on voting power distribution.
 *   0 = unanimous, 100 = perfectly split.
 */

export interface SpectrumDot {
  drepId: string;
  drepName: string | null;
  vote: 'Yes' | 'No' | 'Abstain';
  /** 0-1 horizontal position: No=0-0.25, Abstain=0.4-0.6, Yes=0.75-1.0 */
  x: number;
  /** Radius in px — log-scaled voting power */
  radius: number;
  /** Raw voting power in ADA */
  votingPowerAda: number;
}

export interface ConvictionPulseData {
  conviction: number;
  polarization: number;
  dots: SpectrumDot[];
  totalVoters: number;
  totalPowerAda: number;
  /** Citizen sentiment 0-100, null if no data */
  citizenSentiment: number | null;
  /** Summary label: "High conviction, low polarization" etc */
  label: string;
}

interface VoteForPulse {
  drepId: string;
  drepName: string | null;
  vote: 'Yes' | 'No' | 'Abstain';
  /** Voting power in lovelace (bigint-safe number) */
  votingPowerLovelace?: number | null;
  /** Has rationale text? */
  hasRationale: boolean;
  /** Rationale quality score 0-100 */
  rationaleQuality?: number | null;
}

// ---------------------------------------------------------------------------
// Conviction
// ---------------------------------------------------------------------------

export function computeConviction(votes: VoteForPulse[]): number {
  if (votes.length === 0) return 0;

  // Rationale rate (0-100)
  const withRationale = votes.filter((v) => v.hasRationale).length;
  const rationaleRate = (withRationale / votes.length) * 100;

  // Average rationale quality (0-100)
  const qualityScores = votes
    .filter((v) => v.rationaleQuality != null && v.rationaleQuality > 0)
    .map((v) => v.rationaleQuality!);
  const avgQuality =
    qualityScores.length > 0 ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : 0;

  // Power concentration — how evenly is power distributed?
  // Uses complement of normalized HHI on voter count basis
  // More voters = less concentration = higher conviction
  const powerValues = votes.map((v) => Number(v.votingPowerLovelace ?? 0)).filter((p) => p > 0);

  let concentrationScore = 50; // default if no power data
  if (powerValues.length > 0) {
    const totalPower = powerValues.reduce((a, b) => a + b, 0);
    if (totalPower > 0) {
      const shares = powerValues.map((p) => p / totalPower);
      const hhi = shares.reduce((sum, s) => sum + s * s, 0);
      // HHI ranges from 1/n (equal) to 1 (monopoly)
      // Normalize: 0 = monopoly, 100 = perfectly equal
      const minHHI = 1 / powerValues.length;
      concentrationScore = powerValues.length === 1 ? 0 : ((1 - hhi) / (1 - minHHI)) * 100;
    }
  }

  // Weighted average
  return Math.round(rationaleRate * 0.3 + avgQuality * 0.4 + concentrationScore * 0.3);
}

// ---------------------------------------------------------------------------
// Polarization
// ---------------------------------------------------------------------------

export function computePolarization(votes: VoteForPulse[]): number {
  if (votes.length <= 1) return 0;

  // Group power by vote choice
  const powerByVote = { Yes: 0, No: 0, Abstain: 0 };
  for (const v of votes) {
    powerByVote[v.vote] += Number(v.votingPowerLovelace ?? 1);
  }

  const total = powerByVote.Yes + powerByVote.No + powerByVote.Abstain;
  if (total === 0) return 0;

  const shares = [powerByVote.Yes / total, powerByVote.No / total, powerByVote.Abstain / total];

  // HHI on voting outcome distribution
  const hhi = shares.reduce((sum, s) => sum + s * s, 0);
  // hhi = 1.0 means unanimous (low polarization), hhi = 0.33 means perfectly split (high polarization)
  // Map: hhi=1 → pol=0, hhi=1/3 → pol=100
  const minHHI = 1 / 3;
  const polarization = ((1 - hhi) / (1 - minHHI)) * 100;

  return Math.round(Math.max(0, Math.min(100, polarization)));
}

// ---------------------------------------------------------------------------
// Spectrum Dots
// ---------------------------------------------------------------------------

export function buildSpectrumDots(votes: VoteForPulse[], topN = 25): SpectrumDot[] {
  // Sort by voting power descending, take top N
  const sorted = [...votes]
    .sort((a, b) => Number(b.votingPowerLovelace ?? 0) - Number(a.votingPowerLovelace ?? 0))
    .slice(0, topN);

  const maxPower = Math.max(1, ...sorted.map((v) => Number(v.votingPowerLovelace ?? 1)));

  return sorted.map((v, i) => {
    const power = Number(v.votingPowerLovelace ?? 1);
    const adaPower = power / 1_000_000;

    // Position by vote: No=0-0.25, Abstain=0.4-0.6, Yes=0.75-1.0
    // Add jitter within range based on index to prevent overlap
    const jitter = (i * 0.618) % 1; // golden ratio jitter
    let x: number;
    switch (v.vote) {
      case 'No':
        x = 0.02 + jitter * 0.23;
        break;
      case 'Abstain':
        x = 0.4 + jitter * 0.2;
        break;
      case 'Yes':
        x = 0.75 + jitter * 0.23;
        break;
    }

    // Radius: log-scaled, min 4px, max 20px
    const logScale = Math.log10(power + 1) / Math.log10(maxPower + 1);
    const radius = Math.max(4, Math.min(20, 4 + logScale * 16));

    return {
      drepId: v.drepId,
      drepName: v.drepName,
      vote: v.vote,
      x,
      radius,
      votingPowerAda: adaPower,
    };
  });
}

// ---------------------------------------------------------------------------
// Label
// ---------------------------------------------------------------------------

function getLabel(conviction: number, polarization: number): string {
  const c = conviction >= 60 ? 'High' : conviction >= 30 ? 'Moderate' : 'Low';
  const p = polarization >= 60 ? 'divided' : polarization >= 30 ? 'mixed' : 'aligned';
  return `${c} conviction, ${p}`;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export function computeConvictionPulseData(
  votes: VoteForPulse[],
  citizenSentiment: number | null = null,
): ConvictionPulseData {
  const conviction = computeConviction(votes);
  const polarization = computePolarization(votes);
  const dots = buildSpectrumDots(votes);

  const totalPowerLovelace = votes.reduce((sum, v) => sum + Number(v.votingPowerLovelace ?? 0), 0);

  return {
    conviction,
    polarization,
    dots,
    totalVoters: votes.length,
    totalPowerAda: totalPowerLovelace / 1_000_000,
    citizenSentiment,
    label: getLabel(conviction, polarization),
  };
}
