/**
 * Inngest function: Consolidate Feedback
 *
 * Triggered when annotations are created on a proposal.
 * Debounced with a 30-second window to batch multiple annotations.
 * Calls the consolidation engine to cluster annotations into themes.
 */

import { inngest } from '@/lib/inngest';
import { consolidateFeedback } from '@/lib/workspace/feedback/consolidation';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';

const log = logger.withContext('ConsolidateFeedback');

export const consolidateFeedbackFn = inngest.createFunction(
  {
    id: 'consolidate-feedback',
    name: 'Consolidate Proposal Feedback',
    retries: 2,
    concurrency: { limit: 3 },
    debounce: {
      key: 'event.data.proposalTxHash + "-" + event.data.proposalIndex',
      period: '30s',
    },
    triggers: { event: 'governada/annotation.created' },
  },
  async ({ event, step }) => {
    const { proposalTxHash, proposalIndex } = event.data as {
      proposalTxHash: string;
      proposalIndex: number;
    };

    log.info('Starting feedback consolidation', { proposalTxHash, proposalIndex });

    const result = await step.run('consolidate', async () => {
      const startMs = Date.now();
      const consolidated = await consolidateFeedback(proposalTxHash, proposalIndex);
      const durationMs = Date.now() - startMs;

      captureServerEvent('feedback_consolidated', {
        proposal_tx_hash: proposalTxHash,
        proposal_index: proposalIndex,
        status: consolidated.status,
        theme_count: consolidated.themeCount,
        duration_ms: durationMs,
      });

      return { ...consolidated, durationMs };
    });

    log.info('Feedback consolidation complete', {
      proposalTxHash,
      proposalIndex,
      ...result,
    });

    return result;
  },
);
