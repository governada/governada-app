import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ReviewWorkspaceDecisionPanel,
  ReviewWorkspaceMobileDecisionTray,
} from '@/components/workspace/review/ReviewWorkspaceDecisionPanels';
import type { VotePhase } from '@/hooks/useVote';

vi.mock('@/components/workspace/review/DecisionPanel', () => ({
  DecisionPanel: ({
    intelContent,
    proposalTitle,
    selectedVote,
  }: {
    intelContent?: ReactNode;
    proposalTitle: string;
    selectedVote: string | null;
  }) => (
    <div
      data-testid="decision-panel"
      data-has-intel={String(Boolean(intelContent))}
      data-selected-vote={selectedVote ?? ''}
    >
      {proposalTitle}
      {intelContent}
    </div>
  ),
}));

vi.mock('@/lib/posthog', () => ({
  posthog: {
    capture: vi.fn(),
  },
}));

function buildProps(overrides: Partial<ComponentProps<typeof ReviewWorkspaceDecisionPanel>> = {}) {
  return {
    currentVoteChoice: null,
    currentVoted: false,
    handleAIDraft: vi.fn(async () => {}),
    handleVoteSelect: vi.fn(),
    handleVoteSubmit: vi.fn(async () => {}),
    isDraftingRationale: false,
    isVoteProcessing: false,
    proposalTitle: 'Treasury Proposal',
    rationaleCitations: null,
    rationaleText: 'Rationale',
    selectedVote: 'Yes' as const,
    setRationaleText: vi.fn(),
    votePhase: { status: 'idle' } as VotePhase,
    voterId: 'drep1test',
    voterRole: 'DRep',
    ...overrides,
  };
}

describe('ReviewWorkspaceDecisionPanels', () => {
  it('passes desktop intel content through the shared decision-panel wrapper', () => {
    render(
      <ReviewWorkspaceDecisionPanel {...buildProps()} intelContent={<div>Intel content</div>} />,
    );

    expect(screen.getByTestId('decision-panel').getAttribute('data-has-intel')).toBe('true');
    expect(screen.getByText('Intel content')).toBeTruthy();
  });

  it('suppresses the mobile vote bar when the proposal is already voted', () => {
    render(
      <ReviewWorkspaceMobileDecisionTray
        {...buildProps({ currentVoted: true })}
        handleMobileVoteSelect={vi.fn()}
        mobileVoteOpen={false}
        onMobileVoteOpenChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Vote Yes' })).toBeNull();
  });

  it('forwards mobile vote taps through the mobile tray when the sheet is closed', () => {
    const handleMobileVoteSelect = vi.fn();

    render(
      <ReviewWorkspaceMobileDecisionTray
        {...buildProps()}
        handleMobileVoteSelect={handleMobileVoteSelect}
        mobileVoteOpen={false}
        onMobileVoteOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Vote Yes'));

    expect(handleMobileVoteSelect).toHaveBeenCalledWith('Yes');
  });

  it('reuses the shared decision panel inside the mobile sheet when the tray is open', () => {
    render(
      <ReviewWorkspaceMobileDecisionTray
        {...buildProps()}
        handleMobileVoteSelect={vi.fn()}
        mobileVoteOpen={true}
        onMobileVoteOpenChange={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Your Decision' });
    const dialogPanel = within(dialog).getByTestId('decision-panel');

    expect(screen.getByText('Your Decision')).toBeTruthy();
    expect(dialogPanel.getAttribute('data-selected-vote')).toBe('Yes');
    expect(dialogPanel.getAttribute('data-has-intel')).toBe('false');
  });
});
