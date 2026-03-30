import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';

export const generateWeeklyDigest = inngest.createFunction(
  { id: 'generate-weekly-digest', retries: 2, triggers: { cron: '0 9 * * 1' } }, // Every Monday at 9am UTC
  async ({ step, logger }) => {
    const supabase = getSupabaseAdmin();

    const flagEnabled = await step.run('check-flag', async () => {
      const { data } = await supabase
        .from('feature_flags')
        .select('enabled')
        .eq('key', 'governance_wrapped')
        .single();
      return data?.enabled ?? false;
    });
    if (!flagEnabled) return { skipped: true };

    const digestResult = await step.run('generate-digests', async () => {
      const { data: activeDreps } = await supabase
        .from('dreps')
        .select('id, score, participation_rate, total_votes, delegator_count')
        .not('score', 'is', null)
        .order('score', { ascending: false })
        .limit(100);

      logger.info('[weekly-digest] Prepared digests', { count: activeDreps?.length ?? 0 });
      return { count: activeDreps?.length ?? 0 };
    });

    return { processed: digestResult.count };
  },
);
