import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomepageMatchWorkspace } from '@/components/hub/HomepageMatchWorkspace';

const { detectMatchCapabilityResultMock, posthogCaptureMock, startMatchMock } = vi.hoisted(() => ({
  detectMatchCapabilityResultMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
  startMatchMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/components/PageViewTracker', () => ({
  PageViewTracker: ({ event }: { event: string }) => <div data-testid="page-view">{event}</div>,
}));

vi.mock('@/components/matching/QuickMatchExperience', () => ({
  QuickMatchExperience: () => <div data-testid="quick-match-experience" />,
}));

vi.mock('@/components/globe/GlobeLayout', () => ({
  GlobeLayout: () => <div data-testid="globe-layout" />,
}));

vi.mock('@/lib/device/capability', () => ({
  detectMatchCapabilityResult: () => detectMatchCapabilityResultMock(),
}));

vi.mock('@/lib/posthog', () => ({
  posthog: { capture: (...args: unknown[]) => posthogCaptureMock(...args) },
}));

vi.mock('@/stores/senecaThreadStore', () => ({
  useSenecaThreadStore: {
    getState: () => ({ startMatch: startMatchMock }),
  },
}));

describe('HomepageMatchWorkspace', () => {
  beforeEach(() => {
    detectMatchCapabilityResultMock.mockReturnValue({ capability: 'cerebro', reason: null });
    posthogCaptureMock.mockClear();
    startMatchMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('routes capable devices to the Cerebro match experience', async () => {
    render(<HomepageMatchWorkspace />);

    await waitFor(() => expect(screen.getByTestId('homepage-cerebro-match')).toBeTruthy());

    expect(screen.getByTestId('globe-layout')).toBeTruthy();
    expect(startMatchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('quick-match-experience')).toBeNull();
    expect(posthogCaptureMock).toHaveBeenCalledWith('match_capability_resolved', {
      capability: 'cerebro',
      reason: null,
    });
  });

  it('routes fallback capability to QuickMatchExperience and captures the reason', async () => {
    detectMatchCapabilityResultMock.mockReturnValue({
      capability: 'workspace_fallback',
      reason: 'reduced_motion',
    });

    render(<HomepageMatchWorkspace />);

    await waitFor(() => expect(screen.getByTestId('homepage-match-workspace')).toBeTruthy());

    expect(screen.getByTestId('quick-match-experience')).toBeTruthy();
    expect(screen.queryByTestId('globe-layout')).toBeNull();
    expect(startMatchMock).not.toHaveBeenCalled();
    expect(posthogCaptureMock).toHaveBeenCalledWith('match_capability_resolved', {
      capability: 'workspace_fallback',
      reason: 'reduced_motion',
    });
    expect(posthogCaptureMock).toHaveBeenCalledWith(
      'mode_match_capability_workspace_fallback_count',
      { reason: 'reduced_motion' },
    );
  });
});
