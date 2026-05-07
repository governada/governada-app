import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReturningSignificantDeltaBehavior } from '@/lib/globe/behaviors/cinematic/returningSignificantDeltaBehavior';
import { getSharedIntent, setSharedIntent } from '@/lib/globe/focusIntent';
import { expectCards, expectPanel, makeCinemaCommand, makeCtx } from './testUtils';

describe('returningSignificantDeltaBehavior', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
    setSharedIntent({ focusedIds: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('soft-pans to the changed node, pulses it, opens delta briefing, and anchors a delta card', () => {
    const ctx = makeCtx();
    createReturningSignificantDeltaBehavior().execute(
      makeCinemaCommand('returning_significant_delta', { drepId: 'drep1abcdefghijklmnop' }),
      ctx,
    );

    expect(ctx.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pulse', nodeId: 'drep1abcdefghijk' }),
      350,
    );
    expect(getSharedIntent().dimStrength).toBe(0.3);
    expectPanel(ctx.dispatch, 'delta_briefing', true);
    expectCards(ctx.dispatch, 1);
  });
});
