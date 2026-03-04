import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { getProposalPriority } from '@/utils/proposalPriority';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { HomepageDualMode } from '@/components/HomepageDualMode';
import { PageViewTracker } from '@/components/PageViewTracker';
import { getFeatureFlag } from '@/lib/featureFlags';
import { CivicaHomePage } from '@/components/civica/CivicaHomePage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Civica — Cardano Governance Intelligence',
  description:
    'Cardano has a government. Know who represents you. Find your DRep, track governance proposals, and participate in on-chain democracy.',
  openGraph: {
    title: 'Civica — Cardano Governance Intelligence',
    description:
      'Know who represents your ADA in Cardano governance. Discover DReps, track proposals, and take action.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civica — Cardano Governance Intelligence',
    description: 'Cardano has a government. Know who represents you.',
  },
};

async function getGovernancePulse() {
  const supabase = createClient();
  const oneWeekAgoBlockTime = Math.floor(Date.now() / 1000) - 604800;

  const [drepsResult, proposalsResult, votesResult, claimedResult, spoResult, ccResult] =
    await Promise.all([
      supabase
        .from('dreps')
        .select(
          'score, participation_rate, rationale_rate, effective_participation, info, size_tier',
        ),
      supabase
        .from('proposals')
        .select(
          'tx_hash, proposal_index, proposal_type, title, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch, created_at',
        ),
      supabase
        .from('drep_votes')
        .select('id', { count: 'exact', head: true })
        .gt('block_time', oneWeekAgoBlockTime),
      supabase
        .from('users')
        .select('wallet_address', { count: 'exact', head: true })
        .not('claimed_drep_id', 'is', null),
      supabase.from('spo_votes').select('pool_id').limit(1000),
      supabase.from('cc_votes').select('cc_hot_id').limit(100),
    ]);

  const dreps = drepsResult.data || [];
  const proposals = proposalsResult.data || [];
  const activeDReps = dreps.filter((d: any) => d.info?.isActive);

  const totalLovelace = activeDReps.reduce((sum: number, d: any) => {
    const lv = parseInt(d.info?.votingPowerLovelace || '0', 10);
    return sum + (isNaN(lv) ? 0 : lv);
  }, 0);
  const totalAda = totalLovelace / 1_000_000;
  const formattedAda =
    totalAda >= 1_000_000_000
      ? `${(totalAda / 1_000_000_000).toFixed(1)}B`
      : totalAda >= 1_000_000
        ? `${(totalAda / 1_000_000).toFixed(1)}M`
        : `${Math.round(totalAda).toLocaleString()}`;

  const pRates = dreps.map((d: any) => d.effective_participation || 0).filter((r: number) => r > 0);
  const avgP =
    pRates.length > 0
      ? Math.round(pRates.reduce((a: number, b: number) => a + b, 0) / pRates.length)
      : 0;

  const openProposals = proposals.filter(
    (p: any) => !p.ratified_epoch && !p.enacted_epoch && !p.dropped_epoch && !p.expired_epoch,
  );

  const spoPoolIds = new Set((spoResult.data || []).map((v: any) => v.pool_id));
  const ccIds = new Set((ccResult.data || []).map((v: any) => v.cc_hot_id));

  return {
    totalAdaGoverned: formattedAda,
    activeProposals: openProposals.length,
    activeDReps: activeDReps.length,
    totalDReps: dreps.length,
    votesThisWeek: votesResult.count || 0,
    claimedDReps: claimedResult.count || 0,
    activeSpOs: spoPoolIds.size,
    ccMembers: ccIds.size,
  };
}

async function getTopDReps() {
  const supabase = createClient();
  const { data } = await supabase
    .from('dreps')
    .select(
      'id, score, effective_participation, size_tier, info, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
    )
    .eq('info->>isActive', 'true')
    .order('score', { ascending: false })
    .limit(6);

  return (data || []).map((row: any) => ({
    drepId: row.id,
    name: row.info?.name || null,
    ticker: row.info?.ticker || null,
    handle: row.info?.handle || null,
    drepScore: row.score || 0,
    sizeTier: row.size_tier || 'small',
    effectiveParticipation: row.effective_participation || 0,
    alignmentTreasuryConservative: row.alignment_treasury_conservative,
    alignmentTreasuryGrowth: row.alignment_treasury_growth,
    alignmentDecentralization: row.alignment_decentralization,
    alignmentSecurity: row.alignment_security,
    alignmentInnovation: row.alignment_innovation,
    alignmentTransparency: row.alignment_transparency,
  }));
}

async function getSSRHolderData(): Promise<{ data: any; walletAddress: string } | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('drepscore_session');
    if (!sessionCookie?.value) return null;

    const session = await validateSessionToken(sessionCookie.value);
    if (!session) return null;

    const supabase = createClient();

    const { data: userData } = await supabase
      .from('users')
      .select('delegated_drep_id, claimed_drep_id, visit_streak')
      .eq('wallet_address', session.walletAddress)
      .single();

    if (!userData) return null;

    const drepId = userData.delegated_drep_id;
    let delegationHealth = null;

    if (drepId) {
      const { data: drep } = await supabase
        .from('dreps')
        .select('id, score, effective_participation, info')
        .eq('id', drepId)
        .single();

      if (drep) {
        const openProposals = await supabase
          .from('proposals')
          .select('tx_hash', { count: 'exact', head: true })
          .is('ratified_epoch', null)
          .is('enacted_epoch', null)
          .is('dropped_epoch', null)
          .is('expired_epoch', null);

        delegationHealth = {
          drepId: drep.id,
          drepName: drep.info?.name || drep.info?.ticker || drep.info?.handle || null,
          drepScore: drep.score || 0,
          participationRate: drep.effective_participation || 0,
          openProposalCount: openProposals.count || 0,
        };
      }
    }

    return {
      data: {
        delegationHealth,
        representationScore: { score: null },
        activeProposals: [],
        repScoreDelta: null,
        visitStreak: userData?.visit_streak ?? 0,
      },
      walletAddress: session.walletAddress,
    };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const [pulseData, topDReps, ssrAuth, civicaEnabled] = await Promise.all([
    getGovernancePulse(),
    getTopDReps(),
    getSSRHolderData(),
    getFeatureFlag('civica_frontend', false),
  ]);

  if (civicaEnabled) {
    return (
      <>
        <PageViewTracker event="homepage_viewed" />
        <CivicaHomePage
          pulseData={pulseData}
          ssrHolderData={ssrAuth?.data || null}
          ssrWalletAddress={ssrAuth?.walletAddress || null}
        />
      </>
    );
  }

  return (
    <>
      <PageViewTracker event="homepage_viewed" />
      <HomepageDualMode
        pulseData={pulseData}
        topDReps={topDReps}
        ssrHolderData={ssrAuth?.data || null}
        ssrWalletAddress={ssrAuth?.walletAddress || null}
      />
    </>
  );
}
