import { describe, expect, it, vi, beforeEach } from 'vitest';

const claudeCreateMock = vi.fn();
const getAnthropicClientMock = vi.fn(async () => ({
  messages: { create: claudeCreateMock },
}));

vi.mock('@/lib/ai', () => ({
  MODELS: { FAST: 'claude-sonnet-test' },
  getAnthropicClient: getAnthropicClientMock,
}));

describe('judgeOutput', () => {
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
