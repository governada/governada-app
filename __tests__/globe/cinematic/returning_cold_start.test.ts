import { describe, expect, it } from 'vitest';
import { createReturningColdStartBehavior } from '@/lib/globe/behaviors/cinematic/returningColdStartBehavior';
import { expectCards, expectPanel, makeCinemaCommand, makeCtx } from './testUtils';

describe('returningColdStartBehavior', () => {
  it('pans when delegated, lightly pulses, opens cold-start briefing, and shows no card by default', () => {
    const ctx = makeCtx();
    createReturningColdStartBehavior().execute(
      makeCinemaCommand('returning_cold_start', {
        stakeAddress: 'stake_cold',
        delegatedDrepId: 'drep1coldstartabcdef',
      }),
      ctx,
    );

    expect(ctx.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pulse', nodeId: 'drep1coldstartab' }),
      450,
    );
    expectPanel(ctx.dispatch, 'cold_start', true);
    expectCards(ctx.dispatch, 0);
  });
});
