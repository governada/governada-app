import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockCreateClient = vi.fn();
const mockLoggerInfo = vi.fn();

vi.mock('@/lib/api/withRouteHandler', () => ({
  withRouteHandler: (handler: unknown) => handler,
}));

vi.mock('@/lib/supabase', () => ({
  createClient: () => mockCreateClient(),
}));

vi.mock('@/lib/koios', () => ({
  blockTimeToEpoch: vi.fn(() => 100),
}));

vi.mock('@/utils/display', () => ({
  getProposalDisplayTitle: (title: string | null) => title ?? 'Untitled Proposal',
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
  },
}));

import { GET } from '@/app/api/workspace/review-queue/route';

function makeProposalsQuery(proposals: Array<Record<string, unknown>>) {
  const chain = {
    select: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn().mockResolvedValue({ data: proposals, error: null }),
  };

  return chain;
}

function makeVoteQuery(rows: Array<Record<string, unknown>>) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  return chain;
}

function makeSummaryQuery(rows: Array<Record<string, unknown>>) {
  const chain = {
    select: vi.fn(() => chain),
    in: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  return chain;
}

function makeSentimentQuery(rows: Array<Record<string, unknown>>) {
  const chain = {
    select: vi.fn(() => chain),
    in: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  return chain;
}

describe('GET /api/workspace/review-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns param_changes in the review queue contract', async () => {
    const proposalsQuery = makeProposalsQuery([
      {
        tx_hash: 'tx-1',
        proposal_index: 0,
        title: 'Governance parameter change',
        abstract: 'Adjust governance timings',
        ai_summary: 'Summary',
        proposal_type: 'ParameterChange',
        param_changes: { govActionLifetime: 12 },
        withdrawal_amount: null,
        treasury_tier: null,
        expiration_epoch: 110,
        block_time: 1_700_000_000,
        meta_json: null,
      },
    ]);
    const voteQuery = makeVoteQuery([]);
    const summaryQuery = makeSummaryQuery([]);
    const sentimentQuery = makeSentimentQuery([]);

    mockCreateClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'proposals') return proposalsQuery;
        if (table === 'drep_votes') return voteQuery;
        if (table === 'proposal_voting_summary') return summaryQuery;
        if (table === 'citizen_sentiment') return sentimentQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const response = await GET(
      createRequest('/api/workspace/review-queue?voterId=drep1abc&voterRole=drep'),
    );
    const body = (await parseJson(response)) as { items: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.paramChanges).toEqual({ govActionLifetime: 12 });
    expect(proposalsQuery.select).toHaveBeenCalledWith(
      'tx_hash, proposal_index, title, abstract, ai_summary, proposal_type, param_changes, withdrawal_amount, treasury_tier, expiration_epoch, block_time, meta_json',
    );
  });
});
