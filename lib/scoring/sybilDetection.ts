/**
 * Sybil Detection for SPO Score V3.
 * Flags SPO pairs with >95% vote correlation (same votes on same proposals).
 * Does NOT affect scores directly — creates a deterrent and audit trail.
 */

export interface SybilFlag {
  poolA: string;
  poolB: string;
  agreementRate: number;
  sharedVotes: number;
}

/**
 * Detect SPO pairs with suspiciously high vote correlation.
 * Only considers pairs with >= minSharedVotes common proposals.
 */
export function detectSybilPairs(
  poolVoteMap: Map<string, Map<string, 'Yes' | 'No' | 'Abstain'>>,
  threshold: number = 0.95,
  minSharedVotes: number = 5,
): SybilFlag[] {
  const flags: SybilFlag[] = [];
  const poolIds = [...poolVoteMap.keys()];

  for (let i = 0; i < poolIds.length; i++) {
    const votesA = poolVoteMap.get(poolIds[i])!;

    for (let j = i + 1; j < poolIds.length; j++) {
      const votesB = poolVoteMap.get(poolIds[j])!;

      // Find shared proposals
      let shared = 0;
      let agreed = 0;

      for (const [proposalKey, voteA] of votesA) {
        const voteB = votesB.get(proposalKey);
        if (voteB !== undefined) {
          shared++;
          if (voteA === voteB) agreed++;
        }
      }

      if (shared >= minSharedVotes) {
        const agreementRate = agreed / shared;
        if (agreementRate >= threshold) {
          flags.push({
            poolA: poolIds[i],
            poolB: poolIds[j],
            agreementRate: Math.round(agreementRate * 1000) / 1000,
            sharedVotes: shared,
          });
        }
      }
    }
  }

  return flags;
}
