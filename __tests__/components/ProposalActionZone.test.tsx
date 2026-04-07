import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProposalActionZone } from '@/components/governada/proposals/ProposalActionZone';
import { CITIZEN_PROPOSAL_ACTION_ID } from '@/lib/navigation/proposalAction';

const { useSegmentMock } = vi.hoisted(() => ({
  useSegmentMock: vi.fn(),
}));

vi.mock('@/components/providers/SegmentProvider', () => ({
  useSegment: useSegmentMock,
}));

vi.mock('@/components/governada/proposals/ProposalBridge', () => ({
  ProposalBridge: () => <div data-testid="proposal-bridge" />,
}));

vi.mock('@/components/governada/proposals/CitizenPulseReadOnly', () => ({
  CitizenPulseReadOnly: () => <div data-testid="citizen-pulse" />,
}));

vi.mock('@/components/governada/proposals/CitizenEngagementSection', () => ({
  CitizenEngagementSection: () => <div data-testid="citizen-engagement-section" />,
}));

vi.mock('@/components/governada/proposals/ProposalDepthGate', () => ({
  ProposalDepthGate: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="proposal-depth-gate">{children}</div>
  ),
}));

describe('ProposalActionZone', () => {
  beforeEach(() => {
    useSegmentMock.mockReset();
  });

  it('uses the workspace bridge for governance actors', () => {
    useSegmentMock.mockReturnValue({ segment: 'drep', isLoading: false });

    render(
      <ProposalActionZone
        txHash="abc"
        proposalIndex={1}
        title="Test Proposal"
        isOpen
        proposalType="InfoAction"
      />,
    );

    expect(screen.getByTestId('proposal-bridge')).toBeInTheDocument();
    expect(screen.getByTestId('citizen-pulse')).toBeInTheDocument();
    expect(screen.queryByTestId('citizen-engagement-section')).not.toBeInTheDocument();
  });

  it('anchors connected citizen engagement to the shared citizen action id', () => {
    useSegmentMock.mockReturnValue({ segment: 'citizen', isLoading: false });

    const { container } = render(
      <ProposalActionZone txHash="abc" proposalIndex={1} title="Test Proposal" isOpen />,
    );

    expect(container.querySelector(`#${CITIZEN_PROPOSAL_ACTION_ID}`)).toBeTruthy();
    expect(screen.getByTestId('citizen-engagement-section')).toBeInTheDocument();
  });
});
