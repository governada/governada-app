import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MECHANICAL_ANSWERS, classifyIntent, getMechanicalAnswer } from '@/lib/seneca/intentRouter';

describe('classifyIntent', () => {
  it('classifies launch mechanical questions', () => {
    expect(classifyIntent('How do I zoom?')).toBe('mechanical');
    expect(classifyIntent('How does Seneca decide what to show me?')).toBe('mechanical');
    expect(classifyIntent('What does the constellation shape mean?')).toBe('mechanical');
    expect(classifyIntent("What's a DRep?")).toBe('mechanical');
  });

  it('classifies direct candidate-set requests as interrogative', () => {
    expect(classifyIntent('Show me top DReps')).toBe('interrogative');
    expect(classifyIntent('Find someone who fits my views')).toBe('interrogative');
  });

  it('classifies observations and ambiguous how-questions as observational', () => {
    expect(classifyIntent('Tell me about the constellation')).toBe('observational');
    expect(classifyIntent('How is this DRep doing?')).toBe('observational');
  });

  it('returns the mechanical answer used in the markdown prompt bank', () => {
    const answer = getMechanicalAnswer('How do I zoom?');
    expect(answer).toBe(
      'Scroll or pinch to move closer to the constellation. Use the reset control when you want the whole field back.',
    );

    const markdown = readFileSync(
      join(process.cwd(), 'lib/seneca/prompts/mechanicalAnswers.md'),
      'utf8',
    );
    expect(markdown).toContain(answer);
    expect(MECHANICAL_ANSWERS).toHaveLength(10);
  });
});
