import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const PROMPT_PATH = 'lib/seneca/prompts/regionSuggestion.md';

describe('region suggestion prompt', () => {
  it('contains the Q3.3 constraint set', async () => {
    const prompt = await readFile(PROMPT_PATH, 'utf8');

    expect(prompt).toContain('compressed, observational, civic register');
    expect(prompt).toContain('1-2 sentences maximum');
    expect(prompt).toContain('no directive verbs');
    expect(prompt).toContain('No questions to the user');
    expect(prompt).toContain('Persona awareness');
    expect(prompt).toContain('Return plain text only');
  });

  it('contains the 8-example few-shot bank', async () => {
    const prompt = await readFile(PROMPT_PATH, 'utf8');
    const examples = prompt.match(/^\d+\.\s+"/gm) ?? [];

    expect(examples).toHaveLength(8);
    expect(prompt).toContain('Eight DReps here.');
    expect(prompt).toContain('This cluster has gone quiet');
    expect(prompt).toContain('Your strongest match in this cluster scores 84%.');
  });
});
