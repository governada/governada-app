import { describe, expect, it, vi } from 'vitest';
import { buildFirstVisitBriefing, logFirstVisitBriefing } from '@/lib/seneca/firstVisitBriefing';
import { logEvergreenFallback } from '@/lib/seneca/evergreenFallbacks';
import { logMechanicalAnswerOutput, logSenecaIntentOutput } from '@/lib/seneca/intentRouter';
import { hashUserContextIdentifier } from '@/lib/seneca/outputLog';

describe('Seneca output logging surfaces', () => {
  it('hashes identity to a 16-character value without retaining the raw identifier', async () => {
    const hash = await hashUserContextIdentifier('stake_test1_raw_identifier');

    expect(hash).toMatch(/^[a-f0-9]{16}$/);
    expect(hash).not.toContain('stake_test');
  });

  it('logs first-visit briefing, evergreen fallback, mechanical answer, and emitted observations', async () => {
    const logger = vi.fn(async () => ({ ok: true }));

    await logFirstVisitBriefing(buildFirstVisitBriefing(), { logger });
    await logEvergreenFallback('returning_quiet', { logger });
    await logMechanicalAnswerOutput('How do I zoom?', 'Scroll or pinch.', { logger });
    await logSenecaIntentOutput({
      intent: 'interrogative',
      outputText: 'I can begin narrowing the field.',
      logger,
    });

    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'idle_briefing', intent: 'observational' }),
    );
    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'evergreen_fallback', intent: 'observational' }),
    );
    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'mechanical_answer', intent: 'mechanical' }),
    );
    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'observation_emitted', intent: 'interrogative' }),
    );
  });
});
