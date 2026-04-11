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

const { default: MatchPage } = await import('@/app/match/page');

describe('MatchPage', () => {
  it('renders the shared home shell in match mode with the route activator', () => {
    render(<MatchPage />);

    expect(matchRouteActivatorMock).toHaveBeenCalledWith({}, undefined);
    expect(homePageShellMock).toHaveBeenCalledWith(
      {
        match: true,
        pageViewEvent: 'match_page_viewed',
      },
      undefined,
    );
    expect(screen.queryByTestId('match-route-activator')).not.toBeNull();
    expect(screen.getByTestId('home-page-shell').getAttribute('data-match')).toBe('true');
    expect(screen.getByTestId('home-page-shell').getAttribute('data-page-view-event')).toBe(
      'match_page_viewed',
    );
  });
});
