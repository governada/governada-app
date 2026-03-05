import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';

export const notifyEpochRecap = inngest.createFunction(
  { id: 'notify-epoch-recap', retries: 2 },
  [{ event: 'drepscore/sync.scores' }],
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

    const EPOCH_START_UNIX = 1596491091;
    const EPOCH_LENGTH = 432000;
    const currentEpoch = Math.floor(
      (Math.floor(Date.now() / 1000) - EPOCH_START_UNIX) / EPOCH_LENGTH,
    );

    const notifyResult = await step.run('create-notifications', async () => {
      logger.info('[epoch-recap] Epoch recap notifications queued', { epoch: currentEpoch });
      return { epoch: currentEpoch, queued: 0 };
    });

    return notifyResult;
  },
);
