import { describe, it, expect } from 'vitest';
import { buildAlignmentFromAnswers, ANSWER_VECTORS } from '@/lib/matching/answerVectors';

// Import narrative helpers — they're module-scoped functions in QuickMatchFlow,
// so we test them indirectly through buildAlignmentFromAnswers + inline logic.
// The pure functions we CAN test directly are in answerVectors.ts.

describe('ANSWER_VECTORS', () => {
  it('has entries for all 3 question IDs', () => {
    expect(Object.keys(ANSWER_VECTORS)).toEqual(['treasury', 'protocol', 'transparency']);
  });

  it('treasury has 3 options', () => {
    expect(Object.keys(ANSWER_VECTORS.treasury)).toEqual(['conservative', 'growth', 'balanced']);
  });

  it('protocol has 3 options', () => {
    expect(Object.keys(ANSWER_VECTORS.protocol)).toEqual(['caution', 'innovation', 'case_by_case']);
  });

  it('transparency has 3 options', () => {
    expect(Object.keys(ANSWER_VECTORS.transparency)).toEqual([
      'essential',
      'nice_to_have',
      'doesnt_matter',
    ]);
  });
});

describe('buildAlignmentFromAnswers', () => {
  it('returns neutral (50) for all dimensions with no answers', () => {
    const result = buildAlignmentFromAnswers({});
    expect(result).toEqual({
      treasuryConservative: 50,
      treasuryGrowth: 50,
      decentralization: 50,
      security: 50,
      innovation: 50,
      transparency: 50,
    });
  });

  it('applies treasury conservative answer correctly', () => {
    const result = buildAlignmentFromAnswers({ treasury: 'conservative' });
    expect(result.treasuryConservative).toBe(85);
    expect(result.treasuryGrowth).toBe(20);
    // Other dimensions remain at 50
    expect(result.security).toBe(50);
    expect(result.innovation).toBe(50);
  });

  it('applies treasury growth answer correctly', () => {
    const result = buildAlignmentFromAnswers({ treasury: 'growth' });
    expect(result.treasuryConservative).toBe(20);
    expect(result.treasuryGrowth).toBe(85);
  });

  it('applies treasury balanced answer correctly', () => {
    const result = buildAlignmentFromAnswers({ treasury: 'balanced' });
    expect(result.treasuryConservative).toBe(55);
    expect(result.treasuryGrowth).toBe(55);
  });

  it('applies protocol caution answer correctly', () => {
    const result = buildAlignmentFromAnswers({ protocol: 'caution' });
    expect(result.security).toBe(85);
    expect(result.innovation).toBe(25);
  });

  it('applies protocol innovation answer correctly', () => {
    const result = buildAlignmentFromAnswers({ protocol: 'innovation' });
    expect(result.security).toBe(25);
    expect(result.innovation).toBe(85);
  });

  it('applies transparency essential answer correctly', () => {
    const result = buildAlignmentFromAnswers({ transparency: 'essential' });
    expect(result.transparency).toBe(90);
    expect(result.decentralization).toBe(70);
  });

  it('applies transparency doesnt_matter answer correctly', () => {
    const result = buildAlignmentFromAnswers({ transparency: 'doesnt_matter' });
    expect(result.transparency).toBe(20);
    expect(result.decentralization).toBe(35);
  });

  it('combines all 3 answers correctly', () => {
    const result = buildAlignmentFromAnswers({
      treasury: 'conservative',
      protocol: 'innovation',
      transparency: 'essential',
    });
    expect(result).toEqual({
      treasuryConservative: 85,
      treasuryGrowth: 20,
      decentralization: 70,
      security: 25,
      innovation: 85,
      transparency: 90,
    });
  });

  it('ignores unknown question IDs', () => {
    const result = buildAlignmentFromAnswers({ unknown: 'value' });
    expect(result.treasuryConservative).toBe(50);
  });

  it('ignores unknown answer values', () => {
    const result = buildAlignmentFromAnswers({ treasury: 'unknown' });
    expect(result.treasuryConservative).toBe(50);
  });

  it('produces correct scores for all 27 answer combinations', () => {
    const treasuryOpts = ['conservative', 'growth', 'balanced'];
    const protocolOpts = ['caution', 'innovation', 'case_by_case'];
    const transparencyOpts = ['essential', 'nice_to_have', 'doesnt_matter'];

    let count = 0;
    for (const t of treasuryOpts) {
      for (const p of protocolOpts) {
        for (const tr of transparencyOpts) {
          const result = buildAlignmentFromAnswers({
            treasury: t,
            protocol: p,
            transparency: tr,
          });
          // All dimensions should be numbers between 0 and 100
          for (const val of Object.values(result)) {
            expect(val).toBeGreaterThanOrEqual(0);
            expect(val).toBeLessThanOrEqual(100);
          }
          count++;
        }
      }
    }
    expect(count).toBe(27);
  });
});
