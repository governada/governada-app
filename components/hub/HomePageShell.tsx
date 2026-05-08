import { PageViewTracker } from '@/components/PageViewTracker';
import { GlobeLayout } from '@/components/globe/GlobeLayout';
import { HomepageMatchWorkspace } from '@/components/hub/HomepageMatchWorkspace';
import { HomepageSenecaBridge } from '@/components/hub/HomepageSenecaBridge';
import { headers } from 'next/headers';
import Script from 'next/script';
import { isHomepageMatchMode } from '@/lib/matching/routes';
import { getValidatedSessionFromCookies } from '@/lib/navigation/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { logger } from '@/lib/logger';
import { getCinematicState } from '@/lib/governance/prioritizationEngine';
import {
  derivePersonaFromSession,
  type ResolvedSessionPersona,
} from '@/lib/governance/derivePersonaFromSession';
import { getTier0Triggers } from '@/lib/governance/tier0Triggers';
import { recordHomepageVisit } from '@/lib/governance/visitState';
import type {
  GovernanceCinematicContext,
  PrioritizationAcknowledgment,
  Tier0Trigger,
  PrioritizedQueue,
  UserCinematicContext,
  VisitState,
} from '@/types/cinematic';

interface HomePageShellProps {
  filter?: string;
  entity?: string;
  mode?: string;
  sort?: string;
}

const HOME_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Governada',
  url: 'https://governada.io',
  description:
    'Governance intelligence for Cardano. Build your governance team, track proposals, and participate in on-chain democracy.',
  applicationCategory: 'GovernanceApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Governada',
    url: 'https://governada.io',
  },
};

interface HomepageCinematicResult {
  queue: PrioritizedQueue;
  identity: {
    stakeAddress?: string | null;
    userId?: string | null;
  };
}

async function readPrioritizationAcknowledgments(
  identifier: string | null,
): Promise<PrioritizationAcknowledgment[]> {
  if (!identifier) return [];

  const { data, error } = await getSupabaseAdmin()
    .from('prioritization_acknowledgments')
    .select('item_id, acknowledged_at, dismissed_at')
    .eq('user_id_or_stake_address', identifier);

  if (error) {
    throw new Error(`Failed to read prioritization acknowledgments: ${error.message}`);
  }

  return (data ?? []) as PrioritizationAcknowledgment[];
}

async function readPrioritizationAcknowledgmentsSafe(
  identifier: string | null,
): Promise<PrioritizationAcknowledgment[]> {
  try {
    return await readPrioritizationAcknowledgments(identifier);
  } catch (error) {
    logger.warn('Homepage prioritization acknowledgment read failed', {
      context: 'homepage-cinematic',
      error,
    });
    return [];
  }
}

async function recordHomepageVisitSafe(
  stakeAddress: string | null,
  now: Date,
  currentEpoch: number | null,
): ReturnType<typeof recordHomepageVisit> {
  try {
    return await recordHomepageVisit({ stakeAddress, now, currentEpoch });
  } catch (error) {
    logger.warn('Homepage visit tracking failed', {
      context: 'homepage-cinematic',
      error,
    });
    return { tracked: false, visitStarted: false, state: null, priorEpochVisited: null };
  }
}

function fallbackPersonaForSession(
  session: Awaited<ReturnType<typeof getValidatedSessionFromCookies>>,
): ResolvedSessionPersona {
  return session?.walletAddress ? { persona: 'citizen' } : { persona: 'anonymous' };
}

async function derivePersonaFromSessionSafe(
  session: Awaited<ReturnType<typeof getValidatedSessionFromCookies>>,
): Promise<ResolvedSessionPersona> {
  try {
    return await derivePersonaFromSession(session);
  } catch (error) {
    logger.warn('Homepage persona resolution failed', {
      context: 'homepage-cinematic',
      error,
    });
    return fallbackPersonaForSession(session);
  }
}

async function getTier0TriggersSafe(now: Date): Promise<Tier0Trigger[]> {
  try {
    return await getTier0Triggers(now);
  } catch (error) {
    logger.warn('Homepage Tier 0 trigger read failed', {
      context: 'homepage-cinematic',
      error,
    });
    return [];
  }
}

function toVisitState(
  state:
    | {
        last_visit_at: string;
        prior_visit_at: string | null;
      }
    | null
    | undefined,
  priorEpochVisited: number | null,
): VisitState | null {
  if (!state) return null;
  return {
    lastVisitAt: state.last_visit_at,
    priorVisitAt: state.prior_visit_at,
    priorEpochVisited,
  };
}

function hasSignificantSignals(
  userContext: UserCinematicContext,
  governanceContext: GovernanceCinematicContext,
): boolean {
  if ((governanceContext.tier0Triggers?.length ?? 0) > 0) return true;
  if ((governanceContext.actionItems?.length ?? 0) > 0) return true;
  if (typeof userContext.scoreMomentum === 'number' && userContext.scoreMomentum < -3) return true;
  if (userContext.driftClassification === 'high') return true;
  if (typeof userContext.missedVotesCount === 'number' && userContext.missedVotesCount > 3) {
    return true;
  }
  return (
    typeof userContext.currentEpoch === 'number' &&
    typeof userContext.lastEpochVisited === 'number' &&
    userContext.currentEpoch > userContext.lastEpochVisited
  );
}

async function buildHomepageCinematic(): Promise<HomepageCinematicResult> {
  const session = await getValidatedSessionFromCookies();
  const stakeAddress = session?.walletAddress ?? null;
  const userId = session?.userId ?? null;
  const identityKey = stakeAddress ?? userId;
  const now = new Date();
  const currentEpoch = blockTimeToEpoch(Math.floor(now.getTime() / 1000));

  const [resolvedPersona, visitResult, tier0Triggers, acknowledgments] = await Promise.all([
    derivePersonaFromSessionSafe(session),
    recordHomepageVisitSafe(stakeAddress, now, currentEpoch),
    getTier0TriggersSafe(now),
    readPrioritizationAcknowledgmentsSafe(identityKey),
  ]);

  const visitState = toVisitState(visitResult.state, visitResult.priorEpochVisited);
  const hasConnectedWallet = !!stakeAddress;
  const userContextDraft: UserCinematicContext = {
    segment: resolvedPersona.persona,
    hasConnectedWallet,
    stakeAddress,
    userId,
    drepId: resolvedPersona.drepId ?? null,
    poolId: resolvedPersona.poolId ?? null,
    ccHotId: resolvedPersona.ccHotId ?? null,
    delegatedDrepId: resolvedPersona.delegatedDrepId ?? null,
    claimedDrepId: resolvedPersona.drepId ?? null,
    visitState,
    acknowledgments,
    currentEpoch,
    lastEpochVisited: visitResult.priorEpochVisited,
    isFirstWalletVisit:
      hasConnectedWallet && visitResult.visitStarted && visitState?.priorVisitAt === null,
    isInSessionReturn: hasConnectedWallet && visitResult.tracked && !visitResult.visitStarted,
  };
  const governanceContextDraft: GovernanceCinematicContext = { tier0Triggers, now };
  const userContext: UserCinematicContext = {
    ...userContextDraft,
    isColdStart:
      hasConnectedWallet &&
      visitResult.visitStarted &&
      visitState?.priorVisitAt !== null &&
      !!resolvedPersona.delegatedDrepId &&
      !hasSignificantSignals(userContextDraft, governanceContextDraft),
  };

  const queue = await getCinematicState(userContext, governanceContextDraft);

  return {
    queue,
    identity: { stakeAddress, userId },
  };
}

export async function HomePageShell({ filter, entity, mode, sort }: HomePageShellProps) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const isMatchWorkspace = isHomepageMatchMode(mode);
  const cinematic = await buildHomepageCinematic();

  return (
    <>
      <Script
        id="json-ld-organization"
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOME_JSON_LD) }}
      />
      <PageViewTracker event="homepage_viewed" />
      <HomepageSenecaBridge
        queue={cinematic.queue}
        identity={cinematic.identity}
        autoOpenFirstVisit={!isMatchWorkspace}
      />
      {isMatchWorkspace ? (
        <HomepageMatchWorkspace />
      ) : (
        <GlobeLayout initialFilter={filter} initialEntity={entity} initialSort={sort} />
      )}
    </>
  );
}
