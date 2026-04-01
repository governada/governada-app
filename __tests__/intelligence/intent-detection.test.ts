import { describe, it, expect } from 'vitest';
import { detectGlobeIntent, isConversationalQuery } from '@/lib/intelligence/advisor';

// ---------------------------------------------------------------------------
// detectGlobeIntent
// ---------------------------------------------------------------------------

describe('detectGlobeIntent', () => {
  describe('returns null for non-matching input', () => {
    it('returns null for empty string', () => {
      expect(detectGlobeIntent('')).toBeNull();
    });

    it('returns null for very short input', () => {
      expect(detectGlobeIntent('hi')).toBeNull();
    });

    it('returns null for generic question', () => {
      expect(detectGlobeIntent('what is the meaning of life?')).toBeNull();
    });

    it('returns null for ambiguous sentence', () => {
      expect(detectGlobeIntent('I like governance a lot')).toBeNull();
    });
  });

  describe('reset intent', () => {
    it('detects "reset"', () => {
      const result = detectGlobeIntent('reset');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('reset');
    });

    it('detects "clear"', () => {
      expect(detectGlobeIntent('clear')!.type).toBe('reset');
    });

    it('detects "start over"', () => {
      expect(detectGlobeIntent('start over')!.type).toBe('reset');
    });

    it('detects "go back"', () => {
      expect(detectGlobeIntent('go back')!.type).toBe('reset');
    });

    it('detects "home"', () => {
      expect(detectGlobeIntent('home')!.type).toBe('reset');
    });
  });

  describe('match intent', () => {
    it('detects "find my match"', () => {
      const result = detectGlobeIntent('find my match');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('match');
    });

    it('detects "start matching quiz"', () => {
      expect(detectGlobeIntent('start matching quiz')!.type).toBe('match');
    });

    it('detects "match me"', () => {
      expect(detectGlobeIntent('match me')!.type).toBe('match');
    });

    it('detects "do the matching quiz"', () => {
      expect(detectGlobeIntent('do the matching quiz')!.type).toBe('match');
    });

    it('detects "begin match"', () => {
      expect(detectGlobeIntent('begin match')!.type).toBe('match');
    });

    it('detects "find a match"', () => {
      expect(detectGlobeIntent('find a match')!.type).toBe('match');
    });
  });

  describe('temporal intent', () => {
    it('detects "epoch 620"', () => {
      const result = detectGlobeIntent('show me epoch 620');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('temporal');
      expect(result!.epoch).toBe(620);
    });

    it('detects "epoch 1" at boundary', () => {
      const result = detectGlobeIntent('what happened in epoch 1');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('temporal');
      expect(result!.epoch).toBe(1);
    });
  });

  describe('votesplit intent', () => {
    it('detects "how did people vote"', () => {
      const result = detectGlobeIntent('how did people vote on this?');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('votesplit');
    });

    it('detects "vote split"', () => {
      expect(detectGlobeIntent('show me the vote split')!.type).toBe('votesplit');
    });

    it('detects "voting breakdown"', () => {
      expect(detectGlobeIntent('voting breakdown')!.type).toBe('votesplit');
    });

    it('detects "how did dreps vote"', () => {
      expect(detectGlobeIntent('how did dreps vote on that')!.type).toBe('votesplit');
    });

    it('extracts proposal ref from input', () => {
      const result = detectGlobeIntent('how did people vote on abcdef12_3');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('votesplit');
      expect(result!.proposalRef).toBe('abcdef12_3');
    });

    it('returns undefined proposalRef when none present', () => {
      const result = detectGlobeIntent('how did people vote');
      expect(result!.proposalRef).toBeUndefined();
    });
  });

  describe('focus intent', () => {
    it('detects DRep focus — "show drep_abc12345"', () => {
      const result = detectGlobeIntent('show drep_abc12345');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('focus');
      expect(result!.entityType).toBe('drep');
      expect(result!.entityId).toBe('abc12345');
    });

    it('detects pool focus — "about pool_xyzab"', () => {
      const result = detectGlobeIntent('tell me about pool_xyzab');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('focus');
      expect(result!.entityType).toBe('pool');
    });
  });

  describe('browse intent', () => {
    it('detects "show me proposals"', () => {
      const result = detectGlobeIntent('show me proposals');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('browse');
      expect(result!.filter).toBe('proposals');
    });

    it('detects "list all dreps"', () => {
      const result = detectGlobeIntent('list all dreps');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('browse');
      expect(result!.filter).toBe('dreps');
    });

    it('detects "browse spos"', () => {
      const result = detectGlobeIntent('browse spos');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('browse');
      expect(result!.filter).toBe('spos');
    });

    it('detects "show cc"', () => {
      const result = detectGlobeIntent('show constitutional committee');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('browse');
      expect(result!.filter).toBe('cc');
    });

    it('includes tier when present', () => {
      const result = detectGlobeIntent('show me tier 1 dreps');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('browse');
      expect(result!.filter).toBe('dreps');
      expect(result!.tier).toBe(1);
    });

    it('detects treasury proposals browse', () => {
      const result = detectGlobeIntent('show treasury proposals');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('browse');
      expect(result!.filter).toBe('proposals');
    });
  });

  describe('compare intent', () => {
    it('detects "compare X and Y"', () => {
      const result = detectGlobeIntent('compare drep1 and drep2');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('compare');
    });
  });

  describe('workspace intent', () => {
    it('detects "proposals to review"', () => {
      const result = detectGlobeIntent('proposals to review');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('workspace');
      expect(result!.filter).toBe('proposals');
    });

    it('detects "my drafts"', () => {
      const result = detectGlobeIntent('my drafts');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('workspace');
    });

    it('detects "open workspace"', () => {
      const result = detectGlobeIntent('open workspace');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('workspace');
    });

    it('detects "what needs my attention"', () => {
      const result = detectGlobeIntent('what needs my attention');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('workspace');
    });
  });

  it('preserves original query text in result', () => {
    const input = '  show me proposals  ';
    const result = detectGlobeIntent(input);
    expect(result!.query).toBe(input.trim());
  });
});

// ---------------------------------------------------------------------------
// isConversationalQuery
// ---------------------------------------------------------------------------

describe('isConversationalQuery', () => {
  describe('returns true for questions', () => {
    it('recognizes question mark', () => {
      expect(isConversationalQuery('what is this about?')).toBe(true);
    });

    it('recognizes question starters', () => {
      expect(isConversationalQuery('who are the top dreps')).toBe(true);
      expect(isConversationalQuery('what proposals are active')).toBe(true);
      expect(isConversationalQuery('how does delegation work')).toBe(true);
      expect(isConversationalQuery('why is participation low')).toBe(true);
      expect(isConversationalQuery('which drep should I pick')).toBe(true);
    });

    it('recognizes imperative question starters', () => {
      expect(isConversationalQuery('tell me about governance')).toBe(true);
      expect(isConversationalQuery('show me the treasury status')).toBe(true);
      expect(isConversationalQuery('explain how voting works')).toBe(true);
      expect(isConversationalQuery('help me find a drep')).toBe(true);
      expect(isConversationalQuery('compare these two dreps')).toBe(true);
      expect(isConversationalQuery('summarize the latest proposals')).toBe(true);
      expect(isConversationalQuery('analyze this voting pattern')).toBe(true);
    });

    it('recognizes contraction question starters', () => {
      expect(isConversationalQuery("what's happening in governance")).toBe(true);
      expect(isConversationalQuery("who's the best drep")).toBe(true);
      expect(isConversationalQuery("how's the treasury doing")).toBe(true);
    });
  });

  describe('returns true for governance intent patterns', () => {
    it('recognizes "find dreps"', () => {
      expect(isConversationalQuery('find dreps who support innovation')).toBe(true);
    });

    it('recognizes "list all"', () => {
      expect(isConversationalQuery('list all active proposals')).toBe(true);
    });

    it('recognizes "give me"', () => {
      expect(isConversationalQuery('give me a summary of governance')).toBe(true);
    });

    it('recognizes "i want/need"', () => {
      expect(isConversationalQuery('i want to delegate my vote')).toBe(true);
      expect(isConversationalQuery('i need help with voting')).toBe(true);
    });

    it('recognizes governance verb indicators in long sentences', () => {
      expect(isConversationalQuery('this proposal will affect the treasury significantly')).toBe(
        true,
      );
      expect(isConversationalQuery('how does this impact the overall governance health')).toBe(
        true,
      );
    });
  });

  describe('returns false for non-conversational input', () => {
    it('rejects short input (< 8 chars)', () => {
      expect(isConversationalQuery('drep')).toBe(false);
      expect(isConversationalQuery('search')).toBe(false);
    });

    it('rejects empty input', () => {
      expect(isConversationalQuery('')).toBe(false);
      expect(isConversationalQuery('   ')).toBe(false);
    });

    it('rejects short keyword-like input without question markers', () => {
      expect(isConversationalQuery('drep1abc')).toBe(false);
    });
  });
});
