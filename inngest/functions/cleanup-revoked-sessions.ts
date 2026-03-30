import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

const RETENTION_DAYS = 8;

export const cleanupRevokedSessions = inngest.createFunction(
  {
    id: 'cleanup-revoked-sessions',
    retries: 2,
    triggers: { cron: '0 5 * * *' },
  },
  async ({ step }) => {
    const deleted = await step.run('delete-expired-revocations', async () => {
      const supabase = getSupabaseAdmin();
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const { count, error } = await supabase
        .from('revoked_sessions')
        .delete({ count: 'exact' })
        .lt('revoked_at', cutoff);

      if (error) {
        logger.error('Failed to cleanup revoked sessions', { error: error.message });
        throw error;
      }

      return count ?? 0;
    });

    logger.info('Revoked session cleanup complete', { deleted });
    return { deleted };
  },
);
