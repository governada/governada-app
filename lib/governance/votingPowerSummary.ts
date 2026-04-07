import { getGovernanceThresholdForProposal } from '@/lib/governanceThresholds';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase';

export interface VotingPowerSummary {
  yesPower: number;
  noPower: number;
  abstainPower: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  totalActivePower: number;
  threshold: number | null;
  thresholdLabel: string | null;
}

export async function getVotingPowerSummary(
  txHash: string,
  proposalIndex: number,
  proposalType: string,
): Promise<VotingPowerSummary> {
  try {
    const supabase = createClient();

    const [canonicalResult, proposalResult] = await Promise.all([
      supabase
        .from('proposal_voting_summary')
        .select('*')
        .eq('proposal_tx_hash', txHash)
        .eq('proposal_index', proposalIndex)
        .single(),
      supabase
        .from('proposals')
        .select('proposal_type, param_changes')
        .eq('tx_hash', txHash)
        .eq('proposal_index', proposalIndex)
        .maybeSingle(),
    ]);

    const canonical = canonicalResult.data;
    const proposalRow = proposalResult.data as {
      proposal_type?: string | null;
      param_changes?: Record<string, unknown> | null;
    } | null;
    const thresholdResolution = await getGovernanceThresholdForProposal({
      proposalType: proposalRow?.proposal_type ?? proposalType,
      paramChanges: proposalRow?.param_changes ?? null,
    });
    const threshold = thresholdResolution.threshold;
    const thresholdLabel =
      threshold != null ? `${Math.round(threshold * 100)}% of active DRep stake needed` : null;

    if (canonical) {
      const yesPower = Number(canonical.drep_yes_vote_power) || 0;
      const noPower = Number(canonical.drep_no_vote_power) || 0;
      const abstainPower = Number(canonical.drep_abstain_vote_power) || 0;
      const alwaysAbstain = Number(canonical.drep_always_abstain_power) || 0;
      const totalActivePower = yesPower + noPower + abstainPower + alwaysAbstain;

      return {
        yesPower,
        noPower,
        abstainPower,
        yesCount: canonical.drep_yes_votes_cast || 0,
        noCount: canonical.drep_no_votes_cast || 0,
        abstainCount: canonical.drep_abstain_votes_cast || 0,
        totalActivePower,
        threshold,
        thresholdLabel,
      };
    }

    const [votesResult, activeDrepsResult] = await Promise.all([
      supabase
        .from('drep_votes')
        .select('vote, voting_power_lovelace')
        .eq('proposal_tx_hash', txHash)
        .eq('proposal_index', proposalIndex)
        .not('voting_power_lovelace', 'is', null),
      supabase.from('dreps').select('info').eq('info->>isActive', 'true'),
    ]);

    const votes = votesResult.data;
    const activeDreps = activeDrepsResult.data;

    let yesPower = 0;
    let noPower = 0;
    let abstainPower = 0;
    let yesCount = 0;
    let noCount = 0;
    let abstainCount = 0;

    if (votes) {
      for (const vote of votes) {
        const power = Number(vote.voting_power_lovelace) || 0;
        if (vote.vote === 'Yes') {
          yesPower += power;
          yesCount++;
        } else if (vote.vote === 'No') {
          noPower += power;
          noCount++;
        } else {
          abstainPower += power;
          abstainCount++;
        }
      }
    }

    let totalActivePower = 0;
    if (activeDreps) {
      for (const drep of activeDreps) {
        const info = drep.info as Record<string, unknown> | null;
        totalActivePower += parseInt(String(info?.votingPowerLovelace || '0'), 10) || 0;
      }
    }

    return {
      yesPower,
      noPower,
      abstainPower,
      yesCount,
      noCount,
      abstainCount,
      totalActivePower,
      threshold,
      thresholdLabel,
    };
  } catch (err) {
    logger.error('[VotingPowerSummary] getVotingPowerSummary error', {
      error: err,
      txHash,
      proposalIndex,
    });
    return {
      yesPower: 0,
      noPower: 0,
      abstainPower: 0,
      yesCount: 0,
      noCount: 0,
      abstainCount: 0,
      totalActivePower: 0,
      threshold: null,
      thresholdLabel: null,
    };
  }
}
