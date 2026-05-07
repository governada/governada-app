import { describe, expect, it } from 'vitest';
import { createSentimentOpportunityBehavior } from '@/lib/globe/behaviors/cinematic/sentimentOpportunityBehavior';
import { expectCards, expectPanel, makeCinemaCommand, makeCtx } from './testUtils';

describe('sentimentOpportunityBehavior', () => {
  it('pans to proposal cluster, pulses the proposal, opens weigh-in prompt, and anchors sentiment card', () => {
    const ctx = makeCtx();
    createSentimentOpportunityBehavior().execute(
      makeCinemaCommand('sentiment_opportunity', {
        opportunities: [{ txHash: 'aabbccddeeff0011', proposalIndex: 3 }],
      }),
      ctx,
    );

    expect(ctx.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pulse', nodeId: 'proposal-aabbccddeeff-3' }),
      450,
    );
    expectPanel(ctx.dispatch, 'sentiment_prompt', true);
    expectCards(ctx.dispatch, 1);
  });
});
