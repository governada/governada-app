import { describe, expect, it } from 'vitest';
import { createReturningInSessionBehavior } from '@/lib/globe/behaviors/cinematic/returningInSessionBehavior';
import { expectCards, expectPanel, makeCinemaCommand, makeCtx } from './testUtils';

describe('returningInSessionBehavior', () => {
  it('leaves camera attention alone, keeps Seneca closed, and shows no cards', () => {
    const ctx = makeCtx();
    createReturningInSessionBehavior().execute(makeCinemaCommand('returning_in_session'), ctx);

    expect(ctx.schedule).not.toHaveBeenCalled();
    expectPanel(ctx.dispatch, 'closed', false);
    expectCards(ctx.dispatch, 0);
  });
});
