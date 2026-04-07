import * as Sentry from '@sentry/nextjs';

export interface CronMonitorOptions {
  checkinMargin?: number;
  maxRuntime?: number;
}

/**
 * Start a Sentry Cron Monitor check-in.
 * Returns a checkInId to pass to cronCheckOut when the job finishes.
 */
export function cronCheckIn(
  slug: string,
  schedule: string,
  options: CronMonitorOptions = {},
): string {
  return Sentry.captureCheckIn(
    { monitorSlug: slug, status: 'in_progress' },
    {
      schedule: { type: 'crontab', value: schedule },
      checkinMargin: options.checkinMargin ?? 5,
      maxRuntime: options.maxRuntime ?? 30,
    },
  );
}

/**
 * Complete a Sentry Cron Monitor check-in.
 */
export function cronCheckOut(slug: string, checkInId: string, ok: boolean): void {
  Sentry.captureCheckIn({
    checkInId,
    monitorSlug: slug,
    status: ok ? 'ok' : 'error',
  });
}

export async function withCronMonitor<T>(
  slug: string,
  schedule: string,
  task: () => Promise<T>,
  options: CronMonitorOptions = {},
): Promise<T> {
  const checkInId = cronCheckIn(slug, schedule, options);

  try {
    const result = await task();
    cronCheckOut(slug, checkInId, true);
    return result;
  } catch (error) {
    cronCheckOut(slug, checkInId, false);
    throw error;
  }
}
