import { describe, it, expect } from 'vitest';
import {
  detectStreamTopic,
  extractActionMarkers,
  extractGlobeMarkers,
} from '@/lib/intelligence/streamAdvisor';

// ---------------------------------------------------------------------------
// detectStreamTopic
// ---------------------------------------------------------------------------

describe('detectStreamTopic', () => {
  it('detects treasury topic', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>();
    expect(detectStreamTopic('The treasury balance is growing', warmed)).toBe('treasury');
  });

  it('detects treasury from "withdrawal"', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>();
    expect(detectStreamTopic('There is a pending withdrawal request', warmed)).toBe('treasury');
  });

  it('detects treasury from "funding"', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>();
    expect(detectStreamTopic('Funding has been approved', warmed)).toBe('treasury');
  });

  it('detects participation topic', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>();
    expect(detectStreamTopic('Voter participation is increasing', warmed)).toBe('participation');
  });

  it('detects participation from "quorum"', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>();
    expect(detectStreamTopic('The quorum has been reached', warmed)).toBe('participation');
  });

  it('detects participation from "GHI"', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>();
    expect(detectStreamTopic('The GHI score is 72', warmed)).toBe('participation');
  });

  it('detects delegation topic', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>();
    expect(detectStreamTopic('Delegation patterns have shifted', warmed)).toBe('delegation');
  });

  it('detects delegation from "representative"', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>();
    expect(detectStreamTopic('Your representative voted Yes', warmed)).toBe('delegation');
  });

  it('detects delegation from "your DRep"', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>();
    expect(detectStreamTopic('your DRep has been active', warmed)).toBe('delegation');
  });

  it('detects proposals topic', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>();
    expect(detectStreamTopic('A new proposal was submitted', warmed)).toBe('proposals');
  });

  it('detects proposals from "governance action"', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>();
    expect(detectStreamTopic('This governance action is important', warmed)).toBe('proposals');
  });

  it('detects proposals from "hard fork"', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>();
    expect(detectStreamTopic('The hard fork proposal is pending', warmed)).toBe('proposals');
  });

  it('returns null when no topic matches', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>();
    expect(detectStreamTopic('Hello, how are you?', warmed)).toBeNull();
  });

  it('returns null for empty text', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>();
    expect(detectStreamTopic('', warmed)).toBeNull();
  });

  it('skips already-warmed topics (deduplication)', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>(['treasury']);
    // "treasury" is already warmed, so it should be skipped
    expect(detectStreamTopic('The treasury balance is growing', warmed)).toBeNull();
  });

  it('returns next unwarmed topic when first match is already warmed', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>(['treasury']);
    // Text mentions both treasury and proposals — treasury is warmed, so proposals should win
    expect(detectStreamTopic('The treasury is funding a new proposal', warmed)).toBe('proposals');
  });

  it('returns null when all matching topics are already warmed', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>([
      'treasury',
      'participation',
      'delegation',
      'proposals',
    ]);
    expect(
      detectStreamTopic('The treasury proposal for delegation participation', warmed),
    ).toBeNull();
  });

  it('is case-insensitive', () => {
    const warmed = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>();
    expect(detectStreamTopic('TREASURY balance', warmed)).toBe('treasury');
    expect(detectStreamTopic('PARTICIPATION rate', new Set())).toBe('participation');
  });
});

// ---------------------------------------------------------------------------
// extractActionMarkers
// ---------------------------------------------------------------------------

describe('extractActionMarkers', () => {
  it('extracts a single action marker', () => {
    const result = extractActionMarkers('Hello [[action:startMatch]] world');
    expect(result.actions).toEqual(['startMatch']);
    expect(result.cleanText).toBe('Hello  world');
  });

  it('extracts multiple action markers', () => {
    const result = extractActionMarkers('[[action:startMatch]] then [[action:navigate:/pulse]]');
    expect(result.actions).toEqual(['startMatch', 'navigate:/pulse']);
    expect(result.cleanText).toBe(' then ');
  });

  it('returns empty actions array when no markers present', () => {
    const result = extractActionMarkers('Just plain text with no markers');
    expect(result.actions).toEqual([]);
    expect(result.cleanText).toBe('Just plain text with no markers');
  });

  it('handles action with slashes in payload', () => {
    const result = extractActionMarkers('Go here [[action:navigate:/governance/proposals]]');
    expect(result.actions).toEqual(['navigate:/governance/proposals']);
    expect(result.cleanText).toBe('Go here ');
  });

  it('handles text that is only a marker', () => {
    const result = extractActionMarkers('[[action:startMatch]]');
    expect(result.actions).toEqual(['startMatch']);
    expect(result.cleanText).toBe('');
  });

  it('handles empty string input', () => {
    const result = extractActionMarkers('');
    expect(result.actions).toEqual([]);
    expect(result.cleanText).toBe('');
  });

  it('does not extract malformed markers', () => {
    const result = extractActionMarkers('[[action:]] and [[action: missing end');
    // [[action:]] has empty payload between : and ]], should still match the regex
    // The regex is /\[\[action:([^\]]+)\]\]/ — requires at least one char after :
    // [[action:]] — the capture group [^\]]+ requires 1+ chars, so empty won't match
    expect(result.actions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractGlobeMarkers
// ---------------------------------------------------------------------------

describe('extractGlobeMarkers', () => {
  it('extracts a single globe marker with target', () => {
    const result = extractGlobeMarkers('Look at [[globe:flyTo:drep_abc123]] this DRep');
    expect(result.commands).toEqual([{ type: 'flyTo', nodeId: 'drep_abc123' }]);
    expect(result.cleanText).toBe('Look at  this DRep');
  });

  it('extracts a globe marker without target', () => {
    const result = extractGlobeMarkers('Now [[globe:reset]] the view');
    expect(result.commands).toEqual([{ type: 'reset', nodeId: undefined }]);
    expect(result.cleanText).toBe('Now  the view');
  });

  it('extracts multiple globe markers', () => {
    const result = extractGlobeMarkers('[[globe:flyTo:drep_x]] and [[globe:pulse:proposal_abc_0]]');
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0]).toEqual({ type: 'flyTo', nodeId: 'drep_x' });
    expect(result.commands[1]).toEqual({ type: 'pulse', nodeId: 'proposal_abc_0' });
    expect(result.cleanText).toBe(' and ');
  });

  it('returns empty commands array when no markers present', () => {
    const result = extractGlobeMarkers('Just plain text');
    expect(result.commands).toEqual([]);
    expect(result.cleanText).toBe('Just plain text');
  });

  it('handles empty string input', () => {
    const result = extractGlobeMarkers('');
    expect(result.commands).toEqual([]);
    expect(result.cleanText).toBe('');
  });

  it('handles voteSplit marker with proposal ref', () => {
    const result = extractGlobeMarkers('[[globe:voteSplit:abc123_0]]');
    expect(result.commands).toEqual([{ type: 'voteSplit', nodeId: 'abc123_0' }]);
    expect(result.cleanText).toBe('');
  });

  it('handles mixed action and globe markers (only extracts globe)', () => {
    const text = '[[action:startMatch]] and [[globe:reset]]';
    const result = extractGlobeMarkers(text);
    // extractGlobeMarkers only extracts globe markers, leaves action markers
    expect(result.commands).toEqual([{ type: 'reset', nodeId: undefined }]);
    expect(result.cleanText).toBe('[[action:startMatch]] and ');
  });
});
