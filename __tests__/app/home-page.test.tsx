import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildHomepageMatchPath } from '@/lib/matching/routes';

const connectionMock = vi.fn();
const redirectMock = vi.fn();
const homePageShellMock = vi.fn(
  ({
    filter,
    entity,
    mode,
    sort,
  }: {
    filter?: string;
    entity?: string;
    mode?: string;
    sort?: string;
  }) => (
    <div
      data-testid="home-page-shell"
      data-filter={filter}
      data-entity={entity}
      data-mode={mode}
      data-sort={sort}
    />
  ),
);

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('next/server', () => ({
  connection: connectionMock,
}));

vi.mock('@/components/hub/HomePageShell', () => ({
  HomePageShell: homePageShellMock,
}));

const { default: HomePage } = await import('@/app/page');

describe('HomePage', () => {
  beforeEach(() => {
    connectionMock.mockReset();
    connectionMock.mockResolvedValue(undefined);
    redirectMock.mockReset();
    homePageShellMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the shared home shell for ordinary homepage params', async () => {
    render(
      await HomePage({
        searchParams: Promise.resolve({
          filter: 'dreps',
          entity: 'drep:abc',
          mode: 'match',
          sort: 'score',
        }),
      }),
    );

    expect(connectionMock).toHaveBeenCalledOnce();
    expect(homePageShellMock).toHaveBeenCalledWith(
      {
        filter: 'dreps',
        entity: 'drep:abc',
        mode: 'match',
        sort: 'score',
      },
      undefined,
    );
    expect(screen.getByTestId('home-page-shell').getAttribute('data-filter')).toBe('dreps');
    expect(screen.getByTestId('home-page-shell').getAttribute('data-entity')).toBe('drep:abc');
    expect(screen.getByTestId('home-page-shell').getAttribute('data-mode')).toBe('match');
    expect(screen.getByTestId('home-page-shell').getAttribute('data-sort')).toBe('score');
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('redirects legacy query-string match entry into the canonical homepage workspace', async () => {
    render(
      await HomePage({
        searchParams: Promise.resolve({
          match: 'true',
          utm_source: 'campaign',
        }),
      }),
    );

    expect(connectionMock).toHaveBeenCalledOnce();
    expect(redirectMock).toHaveBeenCalledWith(
      buildHomepageMatchPath({
        match: 'true',
        utm_source: 'campaign',
      }),
    );
  });
});
