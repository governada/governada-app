import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const claudeCreateMock = vi.fn();
const getAnthropicClientMock = vi.fn(async () => ({
  messages: { create: claudeCreateMock },
}));

vi.mock('@/lib/ai', () => ({
  MODELS: { FAST: 'claude-sonnet-test' },
  getAnthropicClient: getAnthropicClientMock,
}));

describe('judgeOutput', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getAnthropicClientMock.mockResolvedValue({
      messages: { create: claudeCreateMock },
    });
    claudeCreateMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            referencesData: true,
            literaryWordEarnsKeep: false,
            couldColumnistWrite: true,
            reasoning: 'Specific, but one phrase is decorative.',
          }),
        },
      ],
    });
  });

  it('parses structured judge responses and computes score from booleans', async () => {
    const { judgeOutput } = await import('@/lib/seneca/eval/judge');

    await expect(
      judgeOutput('Two proposals opened, none closed.', 'observational'),
    ).resolves.toEqual({
      referencesData: true,
      literaryWordEarnsKeep: false,
      couldColumnistWrite: true,
      score: 2,
      reasoning: 'Specific, but one phrase is decorative.',
    });
  });

  it('uses distinct prompts for observational and mechanical branches', async () => {
    const { judgeOutput } = await import('@/lib/seneca/eval/judge');

    await judgeOutput('Two proposals opened, none closed.', 'observational');
    await judgeOutput('Scroll or pinch to move closer.', 'mechanical');

    expect(claudeCreateMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        model: 'claude-sonnet-test',
        max_tokens: 350,
        system: expect.stringContaining('Observational Rubric'),
      }),
    );
    expect(claudeCreateMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        model: 'claude-sonnet-test',
        system: expect.stringContaining('Mechanical'),
      }),
    );
  });

  it('retries transient Anthropic errors with backoff before scoring', async () => {
    const { judgeOutput } = await import('@/lib/seneca/eval/judge');
    const transientError = Object.assign(new Error('bad gateway'), { status: 502 });
    const setTimeoutSpy = vi
      .spyOn(global, 'setTimeout')
      .mockImplementation((handler: Parameters<typeof setTimeout>[0]) => {
        if (typeof handler === 'function') handler();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      });
    claudeCreateMock
      .mockRejectedValueOnce(transientError)
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              referencesData: true,
              literaryWordEarnsKeep: true,
              couldColumnistWrite: true,
              reasoning: 'Recovered after transient provider errors without truncating reasoning.',
            }),
          },
        ],
      });

    await expect(
      judgeOutput('The quiet cluster has two new rationales.', 'observational'),
    ).resolves.toEqual({
      referencesData: true,
      literaryWordEarnsKeep: true,
      couldColumnistWrite: true,
      score: 3,
      reasoning: 'Recovered after transient provider errors without truncating reasoning.',
    });
    expect(claudeCreateMock).toHaveBeenCalledTimes(3);
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 250);
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 1_000);
  });

  it('handles Anthropic API errors as score-zero judge failures', async () => {
    const { judgeOutput } = await import('@/lib/seneca/eval/judge');
    claudeCreateMock.mockRejectedValueOnce(new Error('anthropic down'));

    await expect(judgeOutput('The constellation is quiet.', 'observational')).resolves.toEqual({
      referencesData: false,
      literaryWordEarnsKeep: false,
      couldColumnistWrite: false,
      score: 0,
      reasoning: 'judge failure',
    });
  });
});
