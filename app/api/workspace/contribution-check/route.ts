/**
 * Contribution Uniqueness Check API — algorithmic overlap detection.
 *
 * POST: takes { proposalTxHash, proposalIndex, text }, computes keyword
 * overlap (Jaccard similarity) against existing vote rationales.
 * Pure algorithmic — no AI API costs.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { ContributionCheckSchema } from '@/lib/api/schemas/workspace';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Common stop words to exclude from keyword extraction. */
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'is',
  'it',
  'this',
  'that',
  'are',
  'was',
  'be',
  'have',
  'has',
  'had',
  'not',
  'will',
  'would',
  'should',
  'could',
  'can',
  'do',
  'does',
  'did',
  'from',
  'as',
  'if',
  'they',
  'we',
  'he',
  'she',
  'i',
  'you',
  'my',
  'your',
  'their',
  'our',
  'its',
  'so',
  'than',
  'then',
  'there',
  'been',
  'about',
  'more',
  'very',
  'also',
  'just',
  'which',
  'who',
  'what',
  'when',
  'where',
  'how',
  'all',
  'each',
  'every',
  'both',
  'few',
  'some',
  'any',
  'no',
  'nor',
  'too',
  'own',
  'same',
  'other',
  'such',
  'only',
  'over',
  'into',
  'after',
  'before',
  'between',
  'through',
  'during',
  'above',
  'below',
  'up',
  'down',
  'out',
  'off',
  'again',
  'further',
  'once',
  'here',
  'why',
  'because',
  'while',
  'these',
  'those',
  'being',
  'having',
  'doing',
  'proposal',
  'vote',
]);

/** Extract meaningful keywords from text. */
function extractKeywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  return new Set(words);
}

/** Jaccard similarity between two keyword sets. */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Extract top themes (most frequent keywords) from a collection of texts. */
function extractThemes(texts: string[], topN: number = 5): string[] {
  const freq = new Map<string, number>();

  for (const text of texts) {
    const keywords = extractKeywords(text);
    for (const kw of keywords) {
      freq.set(kw, (freq.get(kw) ?? 0) + 1);
    }
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

export const POST = withRouteHandler(
  async (request) => {
    const body = await request.json();
    const parsed = ContributionCheckSchema.parse(body);

    const supabase = createClient();

    // Fetch existing rationale texts for this proposal
    const { data: rationales } = await supabase
      .from('vote_rationales')
      .select('rationale_text')
      .eq('proposal_tx_hash', parsed.proposalTxHash)
      .eq('proposal_index', parsed.proposalIndex)
      .not('rationale_text', 'is', null);

    const existingTexts = (rationales ?? [])
      .map((r) => r.rationale_text as string)
      .filter((t) => t && t.trim().length > 0);

    if (existingTexts.length === 0) {
      return NextResponse.json({
        overlapScore: 0,
        existingThemes: [],
      });
    }

    // Compute overlap against the most similar existing rationale
    const submittedKeywords = extractKeywords(parsed.text);
    let maxOverlap = 0;

    for (const existing of existingTexts) {
      const existingKeywords = extractKeywords(existing);
      const similarity = jaccardSimilarity(submittedKeywords, existingKeywords);
      if (similarity > maxOverlap) maxOverlap = similarity;
    }

    // Extract top themes from all existing rationales
    const existingThemes = extractThemes(existingTexts, 5);

    return NextResponse.json({
      overlapScore: Math.round(maxOverlap * 100) / 100,
      existingThemes,
    });
  },
  { auth: 'optional' },
);
