import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captureCheckIn } = vi.hoisted(() => ({
  captureCheckIn: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureCheckIn,
}));

import { withCronMonitor } from '@/lib/sentry-cron';

describe('withCronMonitor', () => {
  beforeEach(() => {
    captureCheckIn.mockReset();
    captureCheckIn.mockReturnValue('check-in-id');
  });

  it('opens and closes a successful monitor run', async () => {
    const result = await withCronMonitor('sync-slow', '0 4 * * *', async () => 'ok');

    expect(result).toBe('ok');
    expect(captureCheckIn).toHaveBeenNthCalledWith(
      1,
      { monitorSlug: 'sync-slow', status: 'in_progress' },
      expect.objectContaining({
        schedule: { type: 'crontab', value: '0 4 * * *' },
      }),
    );
    expect(captureCheckIn).toHaveBeenNthCalledWith(2, {
      checkInId: 'check-in-id',
      monitorSlug: 'sync-slow',
      status: 'ok',
    });
  });

  it('closes with error when the monitored task fails', async () => {
    await expect(
      withCronMonitor('sync-slow', '0 4 * * *', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(captureCheckIn).toHaveBeenNthCalledWith(2, {
      checkInId: 'check-in-id',
      monitorSlug: 'sync-slow',
      status: 'error',
    });
  });

  it('passes runtime overrides through to the initial monitor check-in', async () => {
    await withCronMonitor('sync-drep-scores', '0 2 * * *', async () => 'ok', { maxRuntime: 45 });

    expect(captureCheckIn).toHaveBeenNthCalledWith(
      1,
      { monitorSlug: 'sync-drep-scores', status: 'in_progress' },
      expect.objectContaining({
        schedule: { type: 'crontab', value: '0 2 * * *' },
        maxRuntime: 45,
      }),
    );
  });
});
