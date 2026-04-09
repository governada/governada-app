import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn();
const getValidatedSessionFromCookiesMock = vi.fn();
const governadaProfileMock = vi.fn(() => <div data-testid="governada-profile" />);

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('@/lib/navigation/session', () => ({
  getValidatedSessionFromCookies: getValidatedSessionFromCookiesMock,
}));

vi.mock('@/components/governada/mygov/GovernadaProfile', () => ({
  GovernadaProfile: governadaProfileMock,
}));

const { default: SettingsPage } = await import('@/app/you/settings/page');

describe('SettingsPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    redirectMock.mockReset();
    getValidatedSessionFromCookiesMock.mockReset();
    governadaProfileMock.mockClear();
  });

  it('redirects anonymous users back through the connect flow with preserved settings intent', async () => {
    getValidatedSessionFromCookiesMock.mockResolvedValue(null);

    render(await SettingsPage());

    expect(redirectMock).toHaveBeenCalledWith('/?connect=1&returnTo=/you/settings');
  });

  it('renders the settings profile for validated sessions', async () => {
    getValidatedSessionFromCookiesMock.mockResolvedValue({ walletAddress: 'stake_test1xyz' });

    render(await SettingsPage());

    expect(governadaProfileMock).toHaveBeenCalledOnce();
    expect(screen.getByTestId('governada-profile')).not.toBeNull();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
