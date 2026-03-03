export interface VoteImpactResult {
  isCloseVote: boolean;
  margin: number;
  marginPercent: number;
  drepContribution: number;
  outcome: 'passed' | 'failed';
  winningVote: 'Yes' | 'No';
  narrative: string;
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toFixed(0);
}

export function calculateVoteImpact(
  yesPower: number,
  noPower: number,
  abstainPower: number,
  drepVotePower: number,
  drepVote: string,
  _userAdaBalance?: number,
): VoteImpactResult {
  const totalVotePower = yesPower + noPower;
  const margin = Math.abs(yesPower - noPower);
  const marginPercent = totalVotePower > 0 ? (margin / totalVotePower) * 100 : 0;
  const isCloseVote = marginPercent < 20;
  const outcome: 'passed' | 'failed' = yesPower >= noPower ? 'passed' : 'failed';
  const winningVote: 'Yes' | 'No' = yesPower >= noPower ? 'Yes' : 'No';
  const drepContribution = margin > 0 ? Math.min((drepVotePower / margin) * 100, 100) : 0;

  const normalizedVote = drepVote.charAt(0).toUpperCase() + drepVote.slice(1).toLowerCase();
  const adaFormatted = formatAda(drepVotePower);

  let narrative: string;

  if (normalizedVote === 'Abstain') {
    narrative = 'Your DRep abstained on this decision.';
  } else if (isCloseVote && normalizedVote === winningVote) {
    narrative = `Your DRep's voting power (${adaFormatted} ADA) represented ${drepContribution.toFixed(1)}% of the winning margin.`;
  } else if (isCloseVote && normalizedVote !== winningVote) {
    narrative = `This was a close vote — your DRep's ${adaFormatted} ADA was on the losing side by a ${formatAda(margin)} ADA margin.`;
  } else {
    const majorityPercent =
      totalVotePower > 0 ? ((Math.max(yesPower, noPower) / totalVotePower) * 100).toFixed(0) : '0';
    if (normalizedVote === winningVote) {
      narrative = `Your DRep's vote was part of the ${majorityPercent}% majority.`;
    } else {
      narrative = `Your DRep voted against the ${majorityPercent}% majority.`;
    }
  }

  return {
    isCloseVote,
    margin,
    marginPercent,
    drepContribution,
    outcome,
    winningVote,
    narrative,
  };
}

/** Convert lovelace bigint from DB to ADA number */
export function lovelaceToAda(lovelace: string | number | bigint): number {
  return Number(BigInt(lovelace)) / 1_000_000;
}
