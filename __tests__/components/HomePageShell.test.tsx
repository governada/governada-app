import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePageShell } from '@/components/hub/HomePageShell';

const {
  headersMock,
  globeLayoutMock,
  homepageMatchWorkspaceMock,
  homepageSenecaBridgeMock,
  getValidatedSessionFromCookiesMock,
  getCinematicStateMock,
  getTier0TriggersMock,
  recordHomepageVisitMock,
  blockTimeToEpochMock,
} = vi.hoisted(() => ({
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
  homepageSenecaBridgeMock: vi.fn(
    ({
      queue,
      autoOpenFirstVisit,
    }: {
      queue: { primary: { state: string } };
      autoOpenFirstVisit?: boolean;
    }) => (
      <div
        data-testid="homepage-seneca-bridge"
        data-state={queue.primary.state}
        data-auto-open={String(autoOpenFirstVisit)}
      />
    ),
  ),
  getValidatedSessionFromCookiesMock: vi.fn(),
  getCinematicStateMock: vi.fn(),
  getTier0TriggersMock: vi.fn(),
  recordHomepageVisitMock: vi.fn(),
  blockTimeToEpochMock: vi.fn(),
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

vi.mock('@/components/hub/HomepageSenecaBridge', () => ({
  HomepageSenecaBridge: homepageSenecaBridgeMock,
}));

vi.mock('@/lib/navigation/session', () => ({
  getValidatedSessionFromCookies: getValidatedSessionFromCookiesMock,
}));

vi.mock('@/lib/governance/prioritizationEngine', () => ({
  getCinematicState: getCinematicStateMock,
}));

vi.mock('@/lib/governance/tier0Triggers', () => ({
  getTier0Triggers: getTier0TriggersMock,
}));

vi.mock('@/lib/governance/visitState', () => ({
  recordHomepageVisit: recordHomepageVisitMock,
}));

vi.mock('@/lib/koios', () => ({
  blockTimeToEpoch: blockTimeToEpochMock,
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: vi.fn(),
}));

describe('HomePageShell', () => {
  beforeEach(() => {
    headersMock.mockResolvedValue(new Headers([['x-nonce', 'nonce-123']]));
    globeLayoutMock.mockClear();
    homepageMatchWorkspaceMock.mockClear();
    homepageSenecaBridgeMock.mockClear();
    getValidatedSessionFromCookiesMock.mockResolvedValue(null);
    getTier0TriggersMock.mockResolvedValue([]);
    recordHomepageVisitMock.mockResolvedValue({
      tracked: false,
      visitStarted: false,
      state: null,
    });
    blockTimeToEpochMock.mockReturnValue(555);
    getCinematicStateMock.mockResolvedValue({
      primary: {
        id: 'first-visit-anonymous',
        tier: 2,
        kind: 'soft',
        state: 'first_visit_anonymous',
        surfaced_at: '2026-05-06T00:00:00.000Z',
        payload: {},
      },
      secondary: [],
      meta: {
        reasoning: 'Anonymous visitors always resolve as first visit with no tracking',
        generatedAt: '2026-05-06T00:00:00.000Z',
      },
    });
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
    expect(recordHomepageVisitMock).toHaveBeenCalledWith({
      stakeAddress: null,
      now: expect.any(Date),
    });
    expect(getTier0TriggersMock).toHaveBeenCalledWith(expect.any(Date));
    expect(getCinematicStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        segment: 'anonymous',
        hasConnectedWallet: false,
        currentEpoch: 555,
      }),
      expect.objectContaining({
        tier0Triggers: [],
        now: expect.any(Date),
      }),
    );
    expect(screen.getByTestId('homepage-seneca-bridge').getAttribute('data-state')).toBe(
      'first_visit_anonymous',
    );
    expect(screen.getByTestId('homepage-seneca-bridge').getAttribute('data-auto-open')).toBe(
      'true',
    );
    expect(homepageMatchWorkspaceMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('json-ld-organization').getAttribute('nonce')).toBe('nonce-123');
  });

  it('renders the canonical homepage quick-match workspace when mode=match', async () => {
    render(await HomePageShell({ mode: 'match' }));

    expect(screen.getByTestId('page-view').textContent).toContain('homepage_viewed');
    expect(homepageMatchWorkspaceMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('homepage-match-workspace')).toBeTruthy();
    expect(globeLayoutMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('homepage-seneca-bridge').getAttribute('data-auto-open')).toBe(
      'false',
    );
    expect(screen.getByTestId('json-ld-organization').getAttribute('nonce')).toBe('nonce-123');
  });
});
