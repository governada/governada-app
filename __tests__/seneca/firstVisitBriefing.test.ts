import { describe, expect, it } from 'vitest';
import { buildFirstVisitBriefing } from '@/lib/seneca/firstVisitBriefing';

describe('buildFirstVisitBriefing', () => {
  it('builds the three-move first-visit anonymous briefing', () => {
    const briefing = buildFirstVisitBriefing({ segment: 'anonymous' });

    expect(briefing.state).toBe('first_visit_anonymous');
    expect(briefing.moves.map((move) => move.id)).toEqual([
      'name_what',
      'explain_position',
      'offer_paths',
    ]);
    expect(briefing.moves.map((move) => move.text)).toEqual([
      "These are Cardano's representatives, its proposals, and the citizens who hold its currency. Together, they govern the network.",
      'Their place in the sky reflects how they govern — what they prioritize, what they protect.',
      "I can show you who's most active, find someone who fits your views, or explain what's being decided right now.",
    ]);
  });

  it('uses the Q4.1 onboarding paths verbatim', () => {
    const briefing = buildFirstVisitBriefing();

    expect(briefing.paths).toEqual([
      {
        id: 'a',
        label: "Show me who's most active.",
        action: 'conversation',
        query: "Show me who's most active.",
      },
      {
        id: 'b',
        label: 'Find someone who fits my views.',
        action: 'match',
        query: 'Find someone who fits my views.',
      },
      {
        id: 'c',
        label: "Explain what's being decided right now.",
        action: 'conversation',
        query: "Explain what's being decided right now.",
      },
    ]);
  });
});
