import { describe, expect, it } from 'vitest';
import { createActionRequiredBehavior } from '@/lib/globe/behaviors/cinematic/actionRequiredBehavior';
import { expectCards, expectPanel, makeCinemaCommand, makeCtx } from './testUtils';

describe('actionRequiredBehavior', () => {
  it('pulses proposals in scope, opens action queue, and dispatches action cards', () => {
    const ctx = makeCtx();
    createActionRequiredBehavior().execute(
      makeCinemaCommand('action_required', {
        items: [
          {
            title: 'Vote on: Hard fork',
            href: '/proposal/deadbeefcafefeed/0',
            deadline: 'Expires in 1 epoch',
          },
          {
            title: 'Vote on: Treasury',
            href: '/proposal/feedfacecafebeef/1',
            deadline: 'Expires in 2 epochs',
          },
        ],
      }),
      ctx,
    );

    expect(ctx.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pulse', nodeId: 'proposal-deadbeefcafe-0' }),
      350,
    );
    expectPanel(ctx.dispatch, 'action_queue', true);
    expectCards(ctx.dispatch, 2);
  });
});
