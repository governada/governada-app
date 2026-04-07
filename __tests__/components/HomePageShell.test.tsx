import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePageShell } from '@/components/hub/HomePageShell';

const { headersMock } = vi.hoisted(() => ({
  headersMock: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: headersMock,
}));

vi.mock('next/script', () => ({
  default: ({
    id,
    nonce,
    dangerouslySetInnerHTML,
  }: {
    id: string;
    nonce?: string;
    dangerouslySetInnerHTML?: { __html: string | TrustedHTML };
  }) => <script data-testid={id} nonce={nonce} dangerouslySetInnerHTML={dangerouslySetInnerHTML} />,
}));

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
  beforeEach(() => {
    headersMock.mockResolvedValue(new Headers([['x-nonce', 'nonce-123']]));
  });

  afterEach(() => {
    cleanup();
  });

  it('passes the homepage shell props through with the default analytics event', async () => {
    render(await HomePageShell({ filter: 'dreps', entity: 'drep:abc', sort: 'score' }));

    expect(screen.getByTestId('page-view').textContent).toContain('homepage_viewed');
    expect(screen.getByTestId('hub-home-page').getAttribute('data-filter')).toBe('dreps');
    expect(screen.getByTestId('hub-home-page').getAttribute('data-entity')).toBe('drep:abc');
    expect(screen.getByTestId('hub-home-page').getAttribute('data-match')).toBe('false');
    expect(screen.getByTestId('hub-home-page').getAttribute('data-sort')).toBe('score');
    expect(screen.getByTestId('json-ld-organization').getAttribute('nonce')).toBe('nonce-123');
  });

  it('supports route-specific match mode and analytics events', async () => {
    render(await HomePageShell({ match: true, pageViewEvent: 'match_page_viewed' }));

    expect(screen.getByTestId('page-view').textContent).toContain('match_page_viewed');
    expect(screen.getByTestId('hub-home-page').getAttribute('data-match')).toBe('true');
  });
});
