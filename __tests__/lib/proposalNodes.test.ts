import { describe, expect, it } from 'vitest';
import {
  buildProposalConstellationNodes,
  computeProposalUrgency,
} from '@/lib/constellation/proposalNodes';

describe('proposal constellation nodes', () => {
  it('builds open proposal nodes from cached proposal rows', () => {
    const nodes = buildProposalConstellationNodes(
      [
        {
          txHash: 'a'.repeat(64),
          index: 2,
          title: 'Security hardening',
          status: 'Open',
          withdrawalAmount: 2_500_000_000,
          expirationEpoch: 103,
          relevantPrefs: ['security'],
          triBody: {
            drep: { yes: 12, no: 3, abstain: 1 },
            spo: { yes: 0, no: 0, abstain: 0 },
            cc: { yes: 0, no: 0, abstain: 0 },
          },
        },
        {
          txHash: 'b'.repeat(64),
          index: 0,
          title: 'Already ratified',
          status: 'ratified',
          withdrawalAmount: null,
          expirationEpoch: 104,
          relevantPrefs: ['innovation'],
          triBody: null,
        },
      ],
      100,
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      id: `proposal-${'a'.repeat(12)}-2`,
      fullId: `${'a'.repeat(64)}#2`,
      name: 'Security hardening',
      nodeType: 'proposal',
      dominant: 'security',
    });
    expect(nodes[0].score).toBeCloseTo(40, 5);
    expect(nodes[0].power).toBeGreaterThan(0.3);
    expect(nodes[0].position).toHaveLength(3);
    expect(nodes[0].scale).toBeGreaterThan(0.08);
  });

  it('falls back to baseline urgency when current epoch is unavailable', () => {
    expect(computeProposalUrgency(120, null)).toBe(0.3);
    expect(computeProposalUrgency(null, 100)).toBe(0.3);
    expect(computeProposalUrgency(99, 100)).toBe(1);
  });
});
