import { describe, expect, it } from 'vitest';
import { createReturningEpochBehavior } from '@/lib/globe/behaviors/cinematic/returningEpochBehavior';
import { expectCards, expectPanel, makeCinemaCommand, makeCtx } from './testUtils';

describe('returningEpochBehavior', () => {
  it('briefly returns to user position, opens the epoch recap, and anchors a summary card', () => {
    const ctx = makeCtx();
    createReturningEpochBehavior().execute(
      makeCinemaCommand('returning_epoch', { stakeAddress: 'stake_epoch' }),
      ctx,
    );

    expect(ctx.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pulse', nodeId: 'user-stake_epoch' }),
      500,
    );
    expectPanel(ctx.dispatch, 'epoch_recap', true);
    expectCards(ctx.dispatch, 1);
  });
});
