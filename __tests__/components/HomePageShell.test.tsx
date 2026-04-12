import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePageShell } from '@/components/hub/HomePageShell';

const { headersMock, globeLayoutMock, homepageMatchWorkspaceMock } = vi.hoisted(() => ({
  headersMock: vi.fn(),
  globeLayoutMock: vi.fn(
    ({
      initialFilter,
      initialEntity,
      initialSort,
    }: {
      initialFilter?: string;
      initialEntity?: string;
      initialSort?: string;
    }) => (
      <div
        data-testid="globe-layout"
        data-filter={initialFilter}
        data-entity={initialEntity}
        data-sort={initialSort}
      />
    ),
  ),
  homepageMatchWorkspaceMock: vi.fn(() => <div data-testid="homepage-match-workspace" />),
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

vi.mock('@/components/globe/GlobeLayout', () => ({
  GlobeLayout: globeLayoutMock,
}));

vi.mock('@/components/hub/HomepageMatchWorkspace', () => ({
  HomepageMatchWorkspace: homepageMatchWorkspaceMock,
}));

describe('HomePageShell', () => {
  beforeEach(() => {
    headersMock.mockResolvedValue(new Headers([['x-nonce', 'nonce-123']]));
    globeLayoutMock.mockClear();
    homepageMatchWorkspaceMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the homepage discovery shell by default', async () => {
    render(await HomePageShell({ filter: 'dreps', entity: 'drep:abc', sort: 'score' }));

    expect(screen.getByTestId('page-view').textContent).toContain('homepage_viewed');
    expect(globeLayoutMock).toHaveBeenCalledWith(
      {
        initialFilter: 'dreps',
        initialEntity: 'drep:abc',
        initialSort: 'score',
      },
      undefined,
    );
    expect(screen.getByTestId('globe-layout').getAttribute('data-filter')).toBe('dreps');
    expect(screen.getByTestId('globe-layout').getAttribute('data-entity')).toBe('drep:abc');
    expect(screen.getByTestId('globe-layout').getAttribute('data-sort')).toBe('score');
    expect(homepageMatchWorkspaceMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('json-ld-organization').getAttribute('nonce')).toBe('nonce-123');
  });

  it('renders the canonical homepage quick-match workspace when mode=match', async () => {
    render(await HomePageShell({ mode: 'match' }));

    expect(screen.getByTestId('page-view').textContent).toContain('homepage_viewed');
    expect(homepageMatchWorkspaceMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('homepage-match-workspace')).toBeTruthy();
    expect(globeLayoutMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('json-ld-organization').getAttribute('nonce')).toBe('nonce-123');
  });
});
