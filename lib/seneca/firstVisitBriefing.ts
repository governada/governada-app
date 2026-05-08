import type { UserCinematicContext } from '@/types/cinematic';
import { logSenecaOutput, type SenecaOutputLogger } from '@/lib/seneca/outputLog';

export type BriefingMoveId = 'name_what' | 'explain_position' | 'offer_paths';
export type BriefingPathId = 'a' | 'b' | 'c';

export interface BriefingMove {
  id: BriefingMoveId;
  text: string;
}

export interface BriefingPath {
  id: BriefingPathId;
  label: string;
  action: 'conversation' | 'match';
  query: string;
}

export interface BriefingPayload {
  state: 'first_visit_anonymous';
  segment: UserCinematicContext['segment'];
  moves: BriefingMove[];
  paths: BriefingPath[];
}

export const FIRST_VISIT_BRIEFING_MOVES: readonly BriefingMove[] = [
  {
    id: 'name_what',
    text: "These are Cardano's representatives, its proposals, and the citizens who hold its currency. Together, they govern the network.",
  },
  {
    id: 'explain_position',
    text: 'Their place in the sky reflects how they govern — what they prioritize, what they protect.',
  },
  {
    id: 'offer_paths',
    text: "I can show you who's most active, find someone who fits your views, or explain what's being decided right now.",
  },
];

export const FIRST_VISIT_BRIEFING_PATHS: readonly BriefingPath[] = [
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
];

export function buildFirstVisitBriefing(
  userContext: Pick<UserCinematicContext, 'segment'> = { segment: 'anonymous' },
): BriefingPayload {
  return {
    state: 'first_visit_anonymous',
    segment: userContext.segment,
    moves: [...FIRST_VISIT_BRIEFING_MOVES],
    paths: [...FIRST_VISIT_BRIEFING_PATHS],
  };
}

export async function logFirstVisitBriefing(
  briefing: BriefingPayload,
  {
    userContextIdentifier,
    logger = logSenecaOutput,
  }: {
    userContextIdentifier?: string | null;
    logger?: SenecaOutputLogger;
  } = {},
): Promise<void> {
  await Promise.all(
    briefing.moves.map((move) =>
      logger({
        intent: 'observational',
        outputText: move.text,
        source: 'idle_briefing',
        userContextIdentifier,
        cinematicState: briefing.state,
      }),
    ),
  );
}
