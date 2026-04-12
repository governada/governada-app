import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildHomepageMatchPath } from '@/lib/matching/routes';

const connectionMock = vi.fn();
const redirectMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('next/server', () => ({
  connection: connectionMock,
}));

const { default: MatchPage, dynamic } = await import('@/app/match/page');

describe('MatchPage', () => {
  beforeEach(() => {
    connectionMock.mockReset();
    connectionMock.mockResolvedValue(undefined);
    redirectMock.mockReset();
  });

  it('forces direct request rendering for redirect alias requests', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('redirects /match into the canonical homepage match workspace', async () => {
    await MatchPage({
      searchParams: Promise.resolve({
        utm_source: 'social',
      }),
    });

    expect(connectionMock).toHaveBeenCalledOnce();
    expect(redirectMock).toHaveBeenCalledWith(
      buildHomepageMatchPath({
        utm_source: 'social',
      }),
    );
  });
});
