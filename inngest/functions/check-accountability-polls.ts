/**
 * Accountability Poll Manager — runs on epoch boundary.
 * Opens new polls for eligible enacted treasury proposals,
 * closes expired poll windows, schedules re-evaluation cycles.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { captureServerEvent } from '@/lib/posthog-server';
import {
  getAccountabilityDelay,
  getNextCycleEpoch,
  ACCOUNTABILITY_POLL_DURATION,
} from '@/lib/treasury';

export const checkAccountabilityPolls = inngest.createFunction(
  {
    id: 'check-accountability-polls',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"accountability-polls"' },
    triggers: { cron: '0 23 * * *' },
  },
  async ({ step }) => {
    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

    // 1. Open new polls for enacted proposals that have passed the gating delay
    const newPolls = await step.run('open-new-polls', async () => {
      const supabase = getSupabaseAdmin();

      const { data: enacted } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, enacted_epoch, treasury_tier')
        .eq('proposal_type', 'TreasuryWithdrawals')
        .not('enacted_epoch', 'is', null);

      if (!enacted) return 0;

      let created = 0;
      for (const p of enacted) {
        const delay = getAccountabilityDelay(p.treasury_tier);
        const eligibleEpoch = p.enacted_epoch + delay;

        if (currentEpoch < eligibleEpoch) continue;

        const { data: existing } = await supabase
          .from('treasury_accountability_polls')
          .select('cycle_number')
          .eq('proposal_tx_hash', p.tx_hash)
          .eq('proposal_index', p.proposal_index)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const closesEpoch = currentEpoch + ACCOUNTABILITY_POLL_DURATION;
        const nextCycle = getNextCycleEpoch(closesEpoch, 1, p.treasury_tier);

        await supabase.from('treasury_accountability_polls').insert({
          proposal_tx_hash: p.tx_hash,
          proposal_index: p.proposal_index,
          cycle_number: 1,
          opened_epoch: currentEpoch,
          closes_epoch: closesEpoch,
          status: 'open',
          next_cycle_epoch: nextCycle,
        });
        created++;
      }
      return created;
    });

    // 2. Close expired poll windows and aggregate results
    const closed = await step.run('close-expired-polls', async () => {
      const supabase = getSupabaseAdmin();

      const { data: expiring } = await supabase
        .from('treasury_accountability_polls')
        .select('proposal_tx_hash, proposal_index, cycle_number, next_cycle_epoch')
        .eq('status', 'open')
        .lte('closes_epoch', currentEpoch);

      if (!expiring) return 0;

      let closedCount = 0;
      for (const poll of expiring) {
        const { data: responses } = await supabase
          .from('treasury_accountability_responses')
          .select('delivered_rating, would_approve_again')
          .eq('proposal_tx_hash', poll.proposal_tx_hash)
          .eq('proposal_index', poll.proposal_index)
          .eq('cycle_number', poll.cycle_number);

        const summary: Record<string, number> = {};
        for (const r of responses || []) {
          summary[r.delivered_rating] = (summary[r.delivered_rating] || 0) + 1;
        }

        await supabase
          .from('treasury_accountability_polls')
          .update({
            status: 'closed',
            results_summary: { ratings: summary, totalResponses: (responses || []).length },
          })
          .eq('proposal_tx_hash', poll.proposal_tx_hash)
          .eq('proposal_index', poll.proposal_index)
          .eq('cycle_number', poll.cycle_number);

        closedCount++;
      }
      return closedCount;
    });

    // 3. Schedule next re-evaluation cycles for closed polls
    const scheduled = await step.run('schedule-next-cycles', async () => {
      const supabase = getSupabaseAdmin();

      const { data: readyForNext } = await supabase
        .from('treasury_accountability_polls')
        .select('proposal_tx_hash, proposal_index, cycle_number, next_cycle_epoch')
        .eq('status', 'closed')
        .not('next_cycle_epoch', 'is', null)
        .lte('next_cycle_epoch', currentEpoch);

      if (!readyForNext) return 0;

      let scheduledCount = 0;
      for (const poll of readyForNext) {
        const { data: existing } = await supabase
          .from('treasury_accountability_polls')
          .select('cycle_number')
          .eq('proposal_tx_hash', poll.proposal_tx_hash)
          .eq('proposal_index', poll.proposal_index)
          .eq('cycle_number', poll.cycle_number + 1)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const { data: proposal } = await supabase
          .from('proposals')
          .select('treasury_tier')
          .eq('tx_hash', poll.proposal_tx_hash)
          .eq('proposal_index', poll.proposal_index)
          .single();

        const newCycle = poll.cycle_number + 1;
        const closesEpoch = currentEpoch + ACCOUNTABILITY_POLL_DURATION;
        const nextCycle = getNextCycleEpoch(closesEpoch, newCycle, proposal?.treasury_tier || null);

        await supabase.from('treasury_accountability_polls').insert({
          proposal_tx_hash: poll.proposal_tx_hash,
          proposal_index: poll.proposal_index,
          cycle_number: newCycle,
          opened_epoch: currentEpoch,
          closes_epoch: closesEpoch,
          status: 'open',
          next_cycle_epoch: nextCycle,
        });

        // Clear the next_cycle_epoch from the previous poll so we don't re-trigger
        await supabase
          .from('treasury_accountability_polls')
          .update({ next_cycle_epoch: null })
          .eq('proposal_tx_hash', poll.proposal_tx_hash)
          .eq('proposal_index', poll.proposal_index)
          .eq('cycle_number', poll.cycle_number);

        scheduledCount++;
      }
      return scheduledCount;
    });

    if (newPolls > 0 || closed > 0 || scheduled > 0) {
      captureServerEvent('accountability_polls_processed', {
        epoch: currentEpoch,
        polls_opened: newPolls,
        polls_closed: closed,
        cycles_scheduled: scheduled,
      });
    }

    return { currentEpoch, newPolls, closed, scheduled };
  },
);
