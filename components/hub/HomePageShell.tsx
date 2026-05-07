import { PageViewTracker } from '@/components/PageViewTracker';
import { GlobeLayout } from '@/components/globe/GlobeLayout';
import { HomepageMatchWorkspace } from '@/components/hub/HomepageMatchWorkspace';
import { HomepageSenecaBridge } from '@/components/hub/HomepageSenecaBridge';
import { headers } from 'next/headers';
import Script from 'next/script';
import { isHomepageMatchMode } from '@/lib/matching/routes';
import { MotionStrengthProvider } from '@/lib/motion/motionStrength';
import { getValidatedSessionFromCookies } from '@/lib/navigation/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { logger } from '@/lib/logger';
import { getCinematicState } from '@/lib/governance/prioritizationEngine';
import { getTier0Triggers } from '@/lib/governance/tier0Triggers';
import { recordHomepageVisit } from '@/lib/governance/visitState';
import type {
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
): ReturnType<typeof recordHomepageVisit> {
  try {
    return await recordHomepageVisit({ stakeAddress, now });
  } catch (error) {
    logger.warn('Homepage visit tracking failed', {
      context: 'homepage-cinematic',
      error,
    });
    return { tracked: false, visitStarted: false, state: null };
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
): VisitState | null {
  if (!state) return null;
  return {
    lastVisitAt: state.last_visit_at,
    priorVisitAt: state.prior_visit_at,
  };
}

async function buildHomepageCinematic(): Promise<HomepageCinematicResult> {
  const session = await getValidatedSessionFromCookies();
  const stakeAddress = session?.walletAddress ?? null;
  const userId = session?.userId ?? null;
  const identityKey = stakeAddress ?? userId;
  const now = new Date();

  const [visitResult, tier0Triggers, acknowledgments] = await Promise.all([
    recordHomepageVisitSafe(stakeAddress, now),
    getTier0TriggersSafe(now),
    readPrioritizationAcknowledgmentsSafe(identityKey),
  ]);

  const visitState = toVisitState(visitResult.state);
  const hasConnectedWallet = !!stakeAddress;
  const userContext: UserCinematicContext = {
    segment: hasConnectedWallet ? 'citizen' : 'anonymous',
    hasConnectedWallet,
    stakeAddress,
    userId,
    visitState,
    acknowledgments,
    currentEpoch: blockTimeToEpoch(Math.floor(now.getTime() / 1000)),
    lastEpochVisited: null,
    isFirstWalletVisit:
      hasConnectedWallet && visitResult.visitStarted && visitState?.priorVisitAt === null,
    isInSessionReturn: hasConnectedWallet && visitResult.tracked && !visitResult.visitStarted,
    isColdStart:
      hasConnectedWallet && visitResult.visitStarted && visitState?.priorVisitAt !== null,
  };

  const queue = await getCinematicState(userContext, { tier0Triggers, now });

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
      <MotionStrengthProvider>
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
      </MotionStrengthProvider>
    </>
  );
}
