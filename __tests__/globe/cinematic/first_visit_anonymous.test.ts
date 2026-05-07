import { describe, expect, it } from 'vitest';
import { createFirstVisitAnonymousBehavior } from '@/lib/globe/behaviors/cinematic/firstVisitAnonymousBehavior';
import { expectCards, expectPanel, makeCinemaCommand, makeCtx } from './testUtils';

describe('firstVisitAnonymousBehavior', () => {
  it('dispatches establishing camera, Seneca introduction, and no anchored cards', () => {
    const ctx = makeCtx();
    createFirstVisitAnonymousBehavior().execute(
      makeCinemaCommand('first_visit_anonymous', { segment: 'anonymous' }),
      ctx,
    );

    expect(ctx.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cinematic',
        state: expect.objectContaining({ dollyTarget: 19 }),
      }),
    );
    expect(ctx.schedule).not.toHaveBeenCalled();
    expectPanel(ctx.dispatch, 'first_visit_briefing', true);
    expectCards(ctx.dispatch, 0);
  });
});
