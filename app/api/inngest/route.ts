import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { syncProposals } from '@/inngest/functions/sync-proposals';
import { syncDreps } from '@/inngest/functions/sync-dreps';
import { syncVotes } from '@/inngest/functions/sync-votes';
import { syncSecondary } from '@/inngest/functions/sync-secondary';
import { syncSlow } from '@/inngest/functions/sync-slow';
import { alertIntegrity } from '@/inngest/functions/alert-integrity';
import { alertInbox } from '@/inngest/functions/alert-inbox';
import { alertApiHealth } from '@/inngest/functions/alert-api-health';
import { checkNotifications } from '@/inngest/functions/check-notifications';
import { generateEpochSummary } from '@/inngest/functions/generate-epoch-summary';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncProposals,
    syncDreps,
    syncVotes,
    syncSecondary,
    syncSlow,
    alertIntegrity,
    alertInbox,
    alertApiHealth,
    checkNotifications,
    generateEpochSummary,
  ],
});
