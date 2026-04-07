import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReviewDecisionFlow } from '@/hooks/useReviewDecisionFlow';
import type { VotePhase } from '@/hooks/useVote';
import type { ReviewQueueItem } from '@/lib/workspace/types';

const useFeatureFlagMock = vi.fn();
const mutateMock = vi.fn();
const useAISkillMock = vi.fn();
const startVoteMock = vi.fn();
const confirmVoteMock = vi.fn();
const resetVoteMock = vi.fn();
const useVoteMock = vi.fn();
const useRegisterReviewCommandsMock = vi.fn();
const captureMock = vi.fn();

vi.mock('@/components/FeatureGate', () => ({
  useFeatureFlag: (flag: string) => useFeatureFlagMock(flag),
}));

vi.mock('@/hooks/useAISkill', () => ({
  useAISkill: () => useAISkillMock(),
}));

vi.mock('@/hooks/useVote', () => ({
  useVote: () => useVoteMock(),
}));

vi.mock('@/hooks/useRegisterReviewCommands', () => ({
  useRegisterReviewCommands: (handlers: unknown) => useRegisterReviewCommandsMock(handlers),
}));

vi.mock('@/lib/posthog', () => ({
  posthog: {
    capture: (...args: unknown[]) => captureMock(...args),
  },
}));

function makeItem(
  txHash: string,
  proposalIndex: number,
  overrides: Partial<ReviewQueueItem> = {},
): ReviewQueueItem {
  return {
    txHash,
    proposalIndex,
    title: `${txHash}-${proposalIndex}`,
    abstract: 'Abstract',
    aiSummary: 'Summary',
    proposalType: 'InfoAction',
    paramChanges: null,
    withdrawalAmount: null,
    treasuryTier: null,
    epochsRemaining: null,
    isUrgent: false,
    interBodyVotes: {
      drep: { yes: 0, no: 0, abstain: 0 },
      spo: { yes: 0, no: 0, abstain: 0 },
      cc: { yes: 0, no: 0, abstain: 0 },
    },
    citizenSentiment: null,
    existingVote: null,
    sealedUntil: null,
    motivation: 'Motivation',
    rationale: 'Rationale',
    references: null,
    ...overrides,
  };
}

function buildOptions(overrides: Partial<Parameters<typeof useReviewDecisionFlow>[0]> = {}) {
  const selectedItem =
    (overrides.selectedItem as ReviewQueueItem | undefined) ?? makeItem('tx-a', 0);

  return {
    getStatus:
      overrides.getStatus ??
      ((txHash: string, proposalIndex: number) =>
        txHash === selectedItem.txHash && proposalIndex === selectedItem.proposalIndex
          ? undefined
          : 'unreviewed'),
    itemContent: overrides.itemContent ?? {
      title: selectedItem.title,
      abstract: selectedItem.abstract || '',
      motivation: selectedItem.motivation || '',
      rationale: selectedItem.rationale || '',
    },
    onVoteSuccess: overrides.onVoteSuccess ?? vi.fn(),
    selectedItem,
    segment: overrides.segment ?? 'drep',
    togglePanel: overrides.togglePanel ?? vi.fn(),
    voterId: overrides.voterId ?? 'drep1test',
  };
}

describe('useReviewDecisionFlow', () => {
  let votePhase: VotePhase;

  beforeEach(() => {
    votePhase = { status: 'idle' };

    useFeatureFlagMock.mockReturnValue(false);
    useAISkillMock.mockReturnValue({ mutate: mutateMock });
    useVoteMock.mockImplementation(() => ({
      phase: votePhase,
      startVote: startVoteMock,
      confirmVote: confirmVoteMock,
      reset: resetVoteMock,
      isProcessing: false,
    }));

    startVoteMock.mockResolvedValue(undefined);
    confirmVoteMock.mockResolvedValue(null);
    mutateMock.mockReset();
    resetVoteMock.mockReset();
    startVoteMock.mockClear();
    confirmVoteMock.mockClear();
    useRegisterReviewCommandsMock.mockClear();
    captureMock.mockClear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('resets decision state on proposal change and does not double-fire success handling', () => {
    votePhase = { status: 'success', txHash: 'vote-hash', vote: 'Yes', confirmed: false };
    const onVoteSuccess = vi.fn();
    const togglePanel = vi.fn();

    const { result, rerender } = renderHook(
      (props: ReturnType<typeof buildOptions>) => useReviewDecisionFlow(props),
      {
        initialProps: buildOptions({ onVoteSuccess, togglePanel }),
      },
    );

    expect(onVoteSuccess).toHaveBeenCalledTimes(1);
    expect(onVoteSuccess).toHaveBeenCalledWith('Yes');

    act(() => {
      result.current.handleVoteSelect('No');
      result.current.setRationaleText('Because of the tradeoffs.');
    });

    expect(result.current.selectedVote).toBe('No');
    expect(result.current.rationaleText).toBe('Because of the tradeoffs.');
    expect(togglePanel).toHaveBeenCalledWith('vote');

    votePhase = { status: 'success', txHash: 'vote-hash', vote: 'Yes', confirmed: true };
    rerender(buildOptions({ onVoteSuccess, togglePanel }));

    expect(onVoteSuccess).toHaveBeenCalledTimes(1);

    votePhase = { status: 'idle' };
    rerender(buildOptions({ selectedItem: makeItem('tx-b', 1), onVoteSuccess, togglePanel }));

    expect(result.current.selectedVote).toBeNull();
    expect(result.current.rationaleText).toBe('');
    expect(result.current.mobileVoteOpen).toBe(false);
    expect(resetVoteMock).toHaveBeenCalledTimes(2);
  });

  it('publishes rationale anchors before starting and confirming a vote', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ anchorUrl: 'ipfs://anchor', anchorHash: 'anchor-hash' }),
    } as Response);

    const selectedItem = makeItem('tx-submit', 2, { title: 'Treasury Action' });
    const { result } = renderHook(() =>
      useReviewDecisionFlow(buildOptions({ selectedItem, voterId: 'drep1submit' })),
    );

    act(() => {
      result.current.handleVoteSelect('Yes');
      result.current.setRationaleText('Detailed rationale for the vote.');
    });

    await act(async () => {
      await result.current.handleVoteSubmit();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/rationale', expect.any(Object));
    expect(startVoteMock).toHaveBeenCalledWith(
      { txHash: 'tx-submit', txIndex: 2, title: 'Treasury Action' },
      'drep',
      'drep1submit',
    );
    expect(confirmVoteMock).toHaveBeenCalledWith('Yes', 'ipfs://anchor', 'anchor-hash');
    expect(captureMock).toHaveBeenCalledWith(
      'review_rationale_submitted',
      expect.objectContaining({
        proposal_tx_hash: 'tx-submit',
        proposal_index: 2,
      }),
    );
  });

  it('uses the codraft path for long rationales and supports mobile vote selection', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    mutateMock.mockImplementation(
      (
        _input: unknown,
        callbacks: {
          onSuccess?: (value: {
            output: {
              structuredRationale: string;
              citations: Array<{ article: string; section?: string; relevance: string }>;
              precedentRefs: Array<{ title: string; outcome: string; relevance: string }>;
              keyQuotes: Array<{ text: string; field: string }>;
            };
          }) => void;
        },
      ) => {
        callbacks.onSuccess?.({
          output: {
            structuredRationale: 'Structured rationale',
            citations: [{ article: 'Article I', relevance: 'Primary authority' }],
            precedentRefs: [{ title: 'Prev proposal', outcome: 'Passed', relevance: 'Similar' }],
            keyQuotes: [{ text: 'Important quote', field: 'rationale' }],
          },
        });
      },
    );

    const { result } = renderHook(() => useReviewDecisionFlow(buildOptions()));

    act(() => {
      result.current.handleMobileVoteSelect('No');
      result.current.setRationaleText('Point one\nPoint two\nPoint three');
    });

    expect(result.current.selectedVote).toBe('No');
    expect(result.current.mobileVoteOpen).toBe(true);

    await act(async () => {
      await result.current.handleAIDraft();
    });

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'rationale-draft',
        input: expect.objectContaining({
          vote: 'No',
        }),
      }),
      expect.any(Object),
    );
    expect(result.current.rationaleText).toBe('Structured rationale');
    expect(result.current.rationaleCitations).toEqual(
      expect.objectContaining({
        citations: expect.arrayContaining([expect.objectContaining({ article: 'Article I' })]),
      }),
    );
  });
});
