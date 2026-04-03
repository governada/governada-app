import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StakeholderLandscape } from '@/components/intelligence/sections/StakeholderLandscape';

const interBodyVotes = {
  drep: { yes: 2, no: 1, abstain: 0 },
  spo: { yes: 3, no: 1, abstain: 0 },
  cc: { yes: 1, no: 0, abstain: 0 },
};

describe('StakeholderLandscape', () => {
  it('hides SPO votes for governance-only parameter changes', () => {
    render(
      <StakeholderLandscape
        interBodyVotes={interBodyVotes}
        proposalType="ParameterChange"
        paramChanges={{ govActionLifetime: 12 }}
      />,
    );

    expect(screen.getByText('DRep')).toBeTruthy();
    expect(screen.getByText('Constitutional Committee')).toBeTruthy();
    expect(screen.queryByText('SPO')).toBeNull();
  });

  it('shows SPO votes for security-relevant parameter changes', () => {
    render(
      <StakeholderLandscape
        interBodyVotes={interBodyVotes}
        proposalType="ParameterChange"
        paramChanges={{ maxTxSize: 32768 }}
      />,
    );

    expect(screen.getByText('SPO')).toBeTruthy();
  });
});
