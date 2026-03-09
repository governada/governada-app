import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { PageViewTracker } from '@/components/PageViewTracker';
import { CivicaHomePage } from '@/components/civica/CivicaHomePage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Governada — Cardano Governance Intelligence',
  description:
    'Cardano has a government. Know who represents you. Find your DRep, track governance proposals, and participate in on-chain democracy.',
  openGraph: {
    title: 'Governada — Cardano Governance Intelligence',
    description:
      'Know who represents your ADA in Cardano governance. Discover DReps, track proposals, and take action.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Governada — Cardano Governance Intelligence',
    description: 'Cardano has a government. Know who represents you.',
  },
};

async function getGovernancePulse() {
  const supabase = createClient();
  const oneWeekAgoBlockTime = Math.floor(Date.now() / 1000) - 604800;

  const [
    drepsResult,
    drepsCountResult,
    proposalsResult,
    votesResult,
    claimedResult,
    spoResult,
    ccResult,
  ] = await Promise.all([
    supabase
      .from('dreps')
      .select('score, participation_rate, rationale_rate, effective_participation, info, size_tier')
      .range(0, 9999),
    supabase.from('dreps').select('id', { count: 'exact', head: true }),
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
    supabase.from('committee_members').select('cc_hot_id, status'),
  ]);

  const dreps = drepsResult.data || [];
  const proposals = proposalsResult.data || [];
  const activeDReps = dreps.filter((d) => (d.info as Record<string, unknown> | null)?.isActive);

  const totalLovelace = activeDReps.reduce((sum: number, d) => {
    const info = d.info as Record<string, unknown> | null;
    const lv = parseInt((info?.votingPowerLovelace as string) || '0', 10);
    return sum + (isNaN(lv) ? 0 : lv);
  }, 0);
  const totalAda = totalLovelace / 1_000_000;
  const formattedAda =
    totalAda >= 1_000_000_000
      ? `${(totalAda / 1_000_000_000).toFixed(1)}B`
      : totalAda >= 1_000_000
        ? `${(totalAda / 1_000_000).toFixed(1)}M`
        : `${Math.round(totalAda).toLocaleString()}`;

  const openProposals = proposals.filter(
    (p) => !p.ratified_epoch && !p.enacted_epoch && !p.dropped_epoch && !p.expired_epoch,
  );

  const spoPoolIds = new Set((spoResult.data || []).map((v) => v.pool_id));
  let ccMemberCount = (ccResult.data || []).filter(
    (m) => !m.status || m.status.toLowerCase() === 'active',
  ).length;

  // Fallback: if committee_members table is empty, count distinct voters from cc_votes
  if (ccMemberCount === 0) {
    const { data: ccVoters } = await supabase.from('cc_votes').select('cc_hot_id').limit(1000);
    if (ccVoters && ccVoters.length > 0) {
      ccMemberCount = new Set(ccVoters.map((v) => v.cc_hot_id)).size;
    }
  }

  return {
    totalAdaGoverned: formattedAda,
    activeProposals: openProposals.length,
    activeDReps: activeDReps.length,
    totalDReps: drepsCountResult.count ?? dreps.length,
    votesThisWeek: votesResult.count || 0,
    claimedDReps: claimedResult.count || 0,
    activeSpOs: spoPoolIds.size,
    ccMembers: ccMemberCount,
  };
}

async function getSSRHolderData(): Promise<{
  data: Record<string, unknown>;
  walletAddress: string;
} | null> {
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
  const [pulseData, ssrAuth] = await Promise.all([getGovernancePulse(), getSSRHolderData()]);

  return (
    <>
      <PageViewTracker event="homepage_viewed" />
      <CivicaHomePage
        pulseData={pulseData}
        ssrHolderData={ssrAuth?.data || undefined}
        ssrWalletAddress={ssrAuth?.walletAddress || null}
      />
    </>
  );
}
