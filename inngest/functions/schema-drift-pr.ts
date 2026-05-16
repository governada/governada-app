import { inngest } from '@/lib/inngest';
import { logger } from '@/lib/logger';
import { alertCritical, alertDiscord } from '@/lib/sync-utils';
import { KOIOS_SCHEMA_DRIFT_EVENT, type SchemaDriftEventData } from '@/lib/koios/schemaObserver';
import { openSchemaDriftPullRequest } from '@/lib/koios/schemaDriftPr';

export const schemaDriftPr = inngest.createFunction(
  {
    id: 'schema-drift-pr',
    name: 'Koios Schema Drift PR',
    retries: 1,
    concurrency: { limit: 1, scope: 'env', key: '"schema-drift-pr"' },
    debounce: {
      key: 'event.data.driftFingerprint',
      period: '5m',
    },
    onFailure: async ({ error, event }) => {
      logger.error(`[SchemaDriftPR] Failed: ${error.message}`);
      await alertCritical(
        'Koios schema drift PR automation failed',
        `Schema drift was detected but the draft PR automation failed.\n\nEvent: ${event.name}\nError: ${error.message}\n\nManual action: inspect the event payload and update utils/koios-schemas.ts if Koios changed shape.`,
      );
    },
    triggers: { event: KOIOS_SCHEMA_DRIFT_EVENT },
  },
  async ({ event, step }) => {
    const data = event.data as SchemaDriftEventData;

    const summary = await step.run('open-schema-drift-pr', async () => {
      const result = await openSchemaDriftPullRequest(data);
      logger.info('[SchemaDriftPR] Processed schema drift event', {
        endpoint: data.endpoint,
        status: result.status,
        branch: result.branch,
        url: result.url,
      });
      return {
        endpoint: data.endpoint,
        status: result.status,
        branch: result.branch,
        url: result.url,
        observedShapeHash: data.observedShapeHash,
        changes: data.changes.length,
      };
    });

    if (summary.status === 'opened') {
      await step.run('notify-schema-drift', async () => {
        await alertDiscord(
          `Koios schema drift detected: ${data.endpoint}`,
          [
            `Draft PR: ${summary.url ?? '(unknown URL)'}`,
            `Field/type changes: ${data.changes.map((change) => change.path).join(', ')}`,
            `Review ${data.targetFile} and confirm benign vs breaking drift.`,
          ].join('\n'),
        );
      });
    }

    return summary;
  },
);
