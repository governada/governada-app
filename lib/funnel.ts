/**
 * Funnel instrumentation — conversion tracking for anonymous → citizen path.
 *
 * Every step in the funnel fires a PostHog event with standardized naming
 * so we can build a proper conversion funnel in the PostHog dashboard.
 */

import { posthog } from '@/lib/posthog';

/* ─── Event names ──────────────────────────────────────── */

export const FUNNEL_EVENTS = {
  // Landing & discovery
  LANDING_VIEWED: 'funnel_landing_viewed',
  EXPLORE_CLICKED: 'funnel_explore_clicked',

  // Match flow
  MATCH_STARTED: 'funnel_match_started',
  MATCH_COMPLETED: 'funnel_match_completed',
  MATCH_RESULT_VIEWED: 'funnel_match_result_viewed',

  // Wallet connection
  WALLET_PROMPT_SHOWN: 'funnel_wallet_prompt_shown',
  WALLET_CONNECTED: 'funnel_wallet_connected',

  // First engagement
  FIRST_ENGAGEMENT: 'funnel_first_engagement',

  // Delegation
  DELEGATION_STARTED: 'funnel_delegation_started',
  DELEGATION_COMPLETED: 'funnel_delegation_completed',
} as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[keyof typeof FUNNEL_EVENTS];

/* ─── Typed capture helpers ────────────────────────────── */

interface FunnelProperties {
  /** Where the event was triggered from */
  source?: string;
  /** Additional context */
  context?: string;
  /** DRep or entity involved */
  entity_id?: string;
  entity_name?: string;
  /** Match score if applicable */
  match_score?: number;
  /** Generic properties */
  [key: string]: string | number | boolean | null | undefined;
}

export function trackFunnel(event: FunnelEvent, properties?: FunnelProperties) {
  posthog.capture(event, {
    funnel_version: 'v1',
    ...properties,
  });
}

/* ─── Onboarding state (localStorage) ─────────────────── */

const ONBOARDING_KEY = 'governada_onboarding';
const SESSION_COUNT_KEY = 'governada_session_count';

export interface OnboardingState {
  walletConnected: boolean;
  exploredGovernance: boolean;
  firstSentimentVote: boolean;
  delegatedDRep: boolean;
  dismissedAt: number | null;
  sessionCount: number;
}

const DEFAULT_ONBOARDING: OnboardingState = {
  walletConnected: false,
  exploredGovernance: false,
  firstSentimentVote: false,
  delegatedDRep: false,
  dismissedAt: null,
  sessionCount: 0,
};

export function getOnboardingState(): OnboardingState {
  if (typeof window === 'undefined') return DEFAULT_ONBOARDING;
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return DEFAULT_ONBOARDING;
    return { ...DEFAULT_ONBOARDING, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ONBOARDING;
  }
}

export function updateOnboardingState(partial: Partial<OnboardingState>) {
  if (typeof window === 'undefined') return;
  const current = getOnboardingState();
  const updated = { ...current, ...partial };
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(updated));
}

export function incrementSessionCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(SESSION_COUNT_KEY);
    const count = (raw ? parseInt(raw, 10) : 0) + 1;
    localStorage.setItem(SESSION_COUNT_KEY, String(count));
    return count;
  } catch {
    return 0;
  }
}

export function isOnboardingComplete(state: OnboardingState): boolean {
  return (
    state.walletConnected &&
    state.exploredGovernance &&
    state.firstSentimentVote &&
    state.delegatedDRep
  );
}

export function isOnboardingDismissed(state: OnboardingState): boolean {
  if (state.dismissedAt) return true;
  // Auto-dismiss after 3 sessions
  if (state.sessionCount >= 3) return true;
  return isOnboardingComplete(state);
}
