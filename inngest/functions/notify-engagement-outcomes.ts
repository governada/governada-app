/**
 * Engagement Outcome Notifications — notifies citizens when proposals
 * they voted on reach a decision.
 *
 * Runs daily after proposal outcomes are tracked.
 * Finds proposals resolved since last run, looks up citizens who cast
 * sentiment votes, and creates personalized follow-up notifications.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { createAlert } from '@/lib/alerts';
import { logger } from '@/lib/logger';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://governada.io';

export const notifyEngagementOutcomes = inngest.createFunction(
  {
    id: 'notify-engagement-outcomes',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"engagement-outcomes"' },
    triggers: { cron: '30 1 * * *' }, // Daily at 01:30 UTC, after track-proposal-outcomes
  },
  async ({ step }) => {
    const supabase = getSupabaseAdmin();

    const result = await step.run('process-outcomes', async () => {
      const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

      // Find proposals resolved in the last epoch
      const { data: resolvedProposals } = await supabase
        .from('proposals')
        .select(
          'tx_hash, proposal_index, title, proposal_type, ratified_epoch, expired_epoch, dropped_epoch',
        )
        .or(
          `ratified_epoch.eq.${currentEpoch},ratified_epoch.eq.${currentEpoch - 1},expired_epoch.eq.${currentEpoch},expired_epoch.eq.${currentEpoch - 1},dropped_epoch.eq.${currentEpoch},dropped_epoch.eq.${currentEpoch - 1}`,
        );

      if (!resolvedProposals?.length) {
        logger.info('[engagement-outcomes] No recently resolved proposals');
        return { processed: 0, notified: 0 };
      }

      let processed = 0;
      let notified = 0;

      for (const proposal of resolvedProposals) {
        const outcome =
          proposal.ratified_epoch != null
            ? 'ratified'
            : proposal.dropped_epoch != null
              ? 'dropped'
              : 'expired';

        // Find citizens who voted sentiment on this proposal
        const { data: sentimentVoters } = await supabase
          .from('citizen_sentiment')
          .select('user_id, sentiment')
          .eq('proposal_tx_hash', proposal.tx_hash)
          .eq('proposal_index', proposal.proposal_index);

        if (!sentimentVoters?.length) continue;

        // Get community sentiment stats
        const supportCount = sentimentVoters.filter((v) => v.sentiment === 'support').length;
        const opposeCount = sentimentVoters.filter((v) => v.sentiment === 'oppose').length;
        const totalVotes = sentimentVoters.length;

        // Check which users have already been notified (via followups table)
        const { data: existing } = await supabase
          .from('citizen_proposal_followups')
          .select('user_id')
          .eq('proposal_tx_hash', proposal.tx_hash)
          .eq('proposal_index', proposal.proposal_index)
          .eq('notified', true);

        const alreadyNotified = new Set((existing || []).map((e) => e.user_id));

        // Deduplicate voters
        const notifiedInRun = new Set<string>();

        for (const voter of sentimentVoters) {
          if (alreadyNotified.has(voter.user_id) || notifiedInRun.has(voter.user_id)) continue;
          notifiedInRun.add(voter.user_id);

          // Calculate agreement percentage
          const agreedWithOutcome =
            (outcome === 'ratified' && voter.sentiment === 'support') ||
            (outcome !== 'ratified' && voter.sentiment === 'oppose');

          const agreementPct = agreedWithOutcome
            ? Math.round(
                ((voter.sentiment === 'support' ? supportCount : opposeCount) / totalVotes) * 100,
              )
            : Math.round(
                ((voter.sentiment === 'support' ? supportCount : opposeCount) / totalVotes) * 100,
              );

          const proposalTitle = proposal.title || proposal.proposal_type || 'A governance proposal';
          const proposalUrl = `${BASE_URL}/proposal/${proposal.tx_hash}/${proposal.proposal_index}`;

          await createAlert(voter.user_id, 'engagement_outcome', {
            outcome,
            sentiment: voter.sentiment,
            proposalTitle,
            proposalUrl,
            agreementPct,
            totalVoters: totalVotes,
          });

          // Record followup to prevent duplicate notifications
          await supabase.from('citizen_proposal_followups').upsert(
            {
              user_id: voter.user_id,
              proposal_tx_hash: proposal.tx_hash,
              proposal_index: proposal.proposal_index,
              sentiment: voter.sentiment,
              outcome,
              notified: true,
            },
            { onConflict: 'id' },
          );

          notified++;
        }
        processed++;
      }

      return { processed, notified };
    });

    logger.info('[engagement-outcomes] Complete', result);
    return result;
  },
);
