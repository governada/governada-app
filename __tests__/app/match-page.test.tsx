import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const homePageShellMock = vi.fn(
  ({ match, pageViewEvent }: { match?: boolean; pageViewEvent?: string }) => (
    <div
      data-testid="home-page-shell"
      data-match={String(Boolean(match))}
      data-page-view-event={pageViewEvent}
    />
  ),
);
const matchRouteActivatorMock = vi.fn(() => <div data-testid="match-route-activator" />);

vi.mock('@/components/hub/HomePageShell', () => ({
  HomePageShell: homePageShellMock,
}));
vi.mock('@/app/match/MatchRouteActivator', () => ({
  MatchRouteActivator: matchRouteActivatorMock,
}));

vi.mock('next/server', () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));

const { default: MatchPage } = await import('@/app/match/page');

describe('MatchPage', () => {
  it('renders the shared home shell with the match route activator', async () => {
    render(await MatchPage());

    expect(matchRouteActivatorMock).toHaveBeenCalledWith({}, undefined);
    expect(homePageShellMock).toHaveBeenCalledWith(
      {
        pageViewEvent: 'match_page_viewed',
      },
      undefined,
    );
    expect(screen.getByTestId('match-route-activator')).toBeInTheDocument();
    expect(screen.getByTestId('home-page-shell').getAttribute('data-match')).toBe('false');
    expect(screen.getByTestId('home-page-shell').getAttribute('data-page-view-event')).toBe(
      'match_page_viewed',
    );
  });
});
