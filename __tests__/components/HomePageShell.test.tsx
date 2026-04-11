import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomePageShell } from '@/components/hub/HomePageShell';

vi.mock('@/components/PageViewTracker', () => ({
  PageViewTracker: ({ event }: { event: string }) => <div data-testid="page-view">{event}</div>,
}));

vi.mock('@/components/hub/HubHomePage', () => ({
  HubHomePage: ({
    filter,
    entity,
    match,
    sort,
  }: {
    filter?: string;
    entity?: string;
    match?: boolean;
    sort?: string;
  }) => (
    <div
      data-testid="hub-home-page"
      data-filter={filter}
      data-entity={entity}
      data-match={String(Boolean(match))}
      data-sort={sort}
    />
  ),
}));

describe('HomePageShell', () => {
  afterEach(() => {
    cleanup();
  });

  it('passes the homepage shell props through with the default analytics event', () => {
    render(<HomePageShell filter="dreps" entity="drep:abc" sort="score" />);

    expect(screen.getByTestId('page-view').textContent).toContain('homepage_viewed');
    expect(screen.getByTestId('hub-home-page').getAttribute('data-filter')).toBe('dreps');
    expect(screen.getByTestId('hub-home-page').getAttribute('data-entity')).toBe('drep:abc');
    expect(screen.getByTestId('hub-home-page').getAttribute('data-match')).toBe('false');
    expect(screen.getByTestId('hub-home-page').getAttribute('data-sort')).toBe('score');
    expect(document.querySelector('[itemtype="https://schema.org/WebApplication"]')).not.toBeNull();
    expect(
      document.querySelector('meta[itemprop="applicationCategory"]')?.getAttribute('content'),
    ).toBe('GovernanceApplication');
  });

  it('supports route-specific match mode and analytics events', () => {
    render(<HomePageShell match pageViewEvent="match_page_viewed" />);

    expect(screen.getByTestId('page-view').textContent).toContain('match_page_viewed');
    expect(screen.getByTestId('hub-home-page').getAttribute('data-match')).toBe('true');
  });
});
