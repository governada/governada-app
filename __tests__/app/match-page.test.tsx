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

vi.mock('@/components/hub/HomePageShell', () => ({
  HomePageShell: homePageShellMock,
}));

const { default: MatchPage } = await import('@/app/match/page');

describe('MatchPage', () => {
  it('renders the shared home shell in match mode', async () => {
    render(await MatchPage());

    expect(homePageShellMock).toHaveBeenCalledWith(
      {
        match: true,
        pageViewEvent: 'match_page_viewed',
      },
      undefined,
    );
    expect(screen.getByTestId('home-page-shell').getAttribute('data-match')).toBe('true');
    expect(screen.getByTestId('home-page-shell').getAttribute('data-page-view-event')).toBe(
      'match_page_viewed',
    );
  });
});
