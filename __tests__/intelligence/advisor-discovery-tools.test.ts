import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadAdvisorDiscoveryTools(proposals: Array<Record<string, unknown>>) {
  vi.doMock('@/lib/data', () => ({
    getAllProposalsWithVoteSummary: vi.fn(async () => proposals),
  }));
  vi.doMock('@/lib/logger', () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }));

  return import('@/lib/intelligence/advisor-discovery-tools');
}

describe('advisor discovery proposal tools', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('computes controversy from tri-body votes and preserves proposal index', async () => {
    const { executeShowControversy } = await loadAdvisorDiscoveryTools([
      {
        title: 'Fund Community Hubs',
        txHash: 'abc123',
        proposalIndex: 7,
        status: 'active',
        triBody: {
          drep: { yes: 8, no: 2, abstain: 0 },
          spo: { yes: 1, no: 5, abstain: 0 },
          cc: { yes: 3, no: 0, abstain: 0 },
        },
      },
      {
        title: 'Low Signal Proposal',
        txHash: 'def456',
        proposalIndex: 2,
        status: 'active',
        triBody: {
          drep: { yes: 0, no: 0, abstain: 0 },
          spo: { yes: 0, no: 0, abstain: 0 },
          cc: { yes: 0, no: 0, abstain: 0 },
        },
      },
    ]);

    const result = await executeShowControversy();

    expect(result.result).toContain('Fund Community Hubs');
    expect(result.result).toContain('abc123#7');
    expect(result.globeCommands).toEqual([{ type: 'showControversy', proposalId: 'abc123_7' }]);
  });

  it('lists only active proposals from the shared status contract', async () => {
    const { executeShowActiveEntities } = await loadAdvisorDiscoveryTools([
      {
        title: 'Still Voting',
        txHash: 'vote123',
        proposalIndex: 4,
        status: 'active',
      },
      {
        title: 'Already Ratified',
        txHash: 'rat123',
        proposalIndex: 9,
        status: 'ratified',
      },
    ]);

    const result = await executeShowActiveEntities({ entity_type: 'proposal' });

    expect(result.result).toContain('Still Voting');
    expect(result.result).toContain('vote123#4');
    expect(result.result).not.toContain('Already Ratified');
    expect(result.globeCommands).toEqual([
      { type: 'showActiveEntities', entityType: 'proposal', entityIds: ['vote123_4'] },
    ]);
  });
});
