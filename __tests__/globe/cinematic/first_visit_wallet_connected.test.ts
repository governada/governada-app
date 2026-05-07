import { describe, expect, it } from 'vitest';
import { createFirstVisitWalletConnectedBehavior } from '@/lib/globe/behaviors/cinematic/firstVisitWalletConnectedBehavior';
import { expectCards, expectPanel, makeCinemaCommand, makeCtx } from './testUtils';

describe('firstVisitWalletConnectedBehavior', () => {
  it('pans to user position, pulses the user node, opens Seneca, and anchors a team card', () => {
    const ctx = makeCtx();
    createFirstVisitWalletConnectedBehavior().execute(
      makeCinemaCommand('first_visit_wallet_connected', { stakeAddress: 'stake_test1' }),
      ctx,
    );

    expect(ctx.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pulse', nodeId: 'user-stake_test1' }),
      450,
    );
    expectPanel(ctx.dispatch, 'team_briefing', true);
    expectCards(ctx.dispatch, 1);
  });
});
