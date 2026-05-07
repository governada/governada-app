import { describe, expect, it } from 'vitest';
import { createReturningQuietBehavior } from '@/lib/globe/behaviors/cinematic/returningQuietBehavior';
import { expectCards, expectPanel, makeCinemaCommand, makeCtx } from './testUtils';

describe('returningQuietBehavior', () => {
  it('keeps quiet-day cinema ambient with no pulse, closed panel, and no anchored cards', () => {
    const ctx = makeCtx();
    createReturningQuietBehavior().execute(makeCinemaCommand('returning_quiet'), ctx);

    expect(ctx.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'pulse' }));
    expect(ctx.schedule).not.toHaveBeenCalled();
    expectPanel(ctx.dispatch, 'closed', false);
    expectCards(ctx.dispatch, 0);
  });
});
