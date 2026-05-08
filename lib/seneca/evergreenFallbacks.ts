import type { CinematicState } from '@/types/cinematic';
import { logSenecaOutput, type SenecaOutputLogger } from '@/lib/seneca/outputLog';

export const EVERGREEN_FALLBACKS: Record<CinematicState, string> = {
  first_visit_anonymous:
    "Cardano has a government. Most who hold its currency do not yet know they're citizens. I can show you how it works — or who, right now, is shaping it.",
  first_visit_wallet_connected:
    'Your wallet is connected. The next useful question is who now carries your voice, and what they have done with it.',
  returning_in_session:
    'You are still inside the same visit. The constellation has not crossed a new threshold since you arrived.',
  returning_quiet:
    'The constellation is quiet. No civic event, personal delta, or action queue item is strong enough to take the room.',
  returning_significant_delta:
    "Something in your representative's record changed since your last visit. The shift is large enough to deserve a closer look when the details return.",
  returning_epoch:
    'A new epoch has begun since your last visit. The shape is familiar, but the ledger has moved.',
  returning_cold_start:
    'Your representative is recently elected. I will have more to say about their record as it develops.',
  civic_event_tier_0:
    'A major governance change is active. Until it settles, it outweighs the quieter personal signals.',
  action_required:
    'There is work attached to your role in governance. The queue is not decorative; it marks decisions still within reach.',
  sentiment_opportunity:
    "You can't vote on this directly, but your representative can. Citizen sentiment is open while the decision is still forming.",
};

export function getEvergreenFallback(state: CinematicState): string {
  return EVERGREEN_FALLBACKS[state];
}

export async function logEvergreenFallback(
  state: CinematicState,
  {
    userContextIdentifier,
    logger = logSenecaOutput,
  }: {
    userContextIdentifier?: string | null;
    logger?: SenecaOutputLogger;
  } = {},
): Promise<void> {
  await logger({
    intent: 'observational',
    outputText: getEvergreenFallback(state),
    source: 'evergreen_fallback',
    userContextIdentifier,
    cinematicState: state,
  });
}
