/**
 * GET /api/briefing/public
 *
 * Public endpoint returning anonymized briefing highlights.
 * No auth required — designed for anonymous visitors.
 *
 * Returns the current epoch, positively-framed headlines, an AI narrative,
 * and basic governance stats. The landing page uses `headline` (first item);
 * the /governance/briefing teaser page uses the full `headlines` array.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HeadlineType = 'proposal' | 'treasury' | 'governance';

interface PublicHeadline {
  title: string;
  description: string;
  type?: HeadlineType;
  /** Navigation target — makes headline clickable */
  href?: string;
}

interface PublicBriefingResponse {
  epoch: number;
  /** First headline — used by the landing page card */
  headline: PublicHeadline | null;
  /** All headlines — used by the full briefing teaser page */
  headlines: PublicHeadline[];
  /** AI-generated narrative summary (truncated for public consumption) */
  narrative: string | null;
  epochStats: {
    activeProposals: number;
    totalDReps: number;
    treasuryBalance?: number;
  };
}

// ---------------------------------------------------------------------------
// Headline builder — positive framing for anonymous visitors
// ---------------------------------------------------------------------------

type RecapData = {
  proposals_submitted: number | null;
  proposals_ratified: number | null;
  proposals_expired: number | null;
  proposals_dropped: number | null;
  drep_participation_pct: number | null;
  treasury_withdrawn_ada: number | null;
  ai_narrative: string | null;
};

/**
 * Build positively-framed headlines for anonymous visitors.
 *
 * Guard rails:
 * - Participation is only shown as a headline when genuinely strong (≥60%
 *   lifecycle participation). Otherwise it's omitted entirely — no reframing
 *   of weak stats, just don't show them.
 * - No negative language: "low", "only", "declining", "weak", "failed" etc.
 *   are never used. Headlines celebrate activity and progress.
 * - The `lifecycleParticipationPct` param is the real metric: % of active
 *   DReps who voted on at least one active proposal across its full
 *   lifetime (not per-epoch).
 */
interface ProposalInfo {
  tx_hash: string;
  proposal_index: number;
  title: string | null;
  proposal_type: string | null;
  withdrawal_amount: number | null;
  proposed_epoch: number | null;
}

function buildPublicHeadlines(
  recap: RecapData | null,
  lifecycleParticipationPct: number | null,
  totalVoters: number,
  activeProposals: ProposalInfo[],
  recapEpoch: number,
): PublicHeadline[] {
  if (!recap) return [];

  const headlines: PublicHeadline[] = [];

  // Ratified proposals — most impactful
  if (recap.proposals_ratified && recap.proposals_ratified > 0) {
    headlines.push({
      title: `Governance approved ${recap.proposals_ratified} proposal${recap.proposals_ratified > 1 ? 's' : ''}`,
      description: recap.proposals_submitted
        ? `${recap.proposals_submitted} were submitted this epoch \u2014 ${recap.proposals_ratified} made it through`
        : 'Ratified on-chain and moving to enactment',
      type: 'proposal',
      href: '/governance/proposals',
    });
  }

  // Treasury withdrawals
  if (recap.treasury_withdrawn_ada && recap.treasury_withdrawn_ada > 0) {
    const ada = recap.treasury_withdrawn_ada;
    const formatted =
      ada >= 1_000_000
        ? `${(ada / 1_000_000).toFixed(1)}M`
        : ada >= 1_000
          ? `${Math.round(ada / 1_000)}K`
          : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(ada);

    headlines.push({
      title: `Treasury paid out ${formatted} ADA`,
      description: 'Approved withdrawal proposals were executed from the community treasury',
      type: 'treasury',
      href: '/governance/treasury',
    });
  }

  // Lifecycle participation — ONLY show when genuinely strong (≥60%)
  if (lifecycleParticipationPct != null && lifecycleParticipationPct >= 60) {
    const pct = Math.round(lifecycleParticipationPct);
    headlines.push({
      title: `${pct}% of representatives engaged on active proposals`,
      description:
        'Measured across each proposal\u2019s full voting window \u2014 governance is well-represented',
      type: 'governance',
      href: '/governance/representatives',
    });
  } else if (totalVoters > 0) {
    headlines.push({
      title: `${totalVoters} representatives actively governing`,
      description:
        'Representatives are reviewing and voting on proposals across their full lifecycle',
      type: 'governance',
      href: '/governance/representatives',
    });
  }

  // Proposals submitted — enriched with proposal details
  if (recap.proposals_submitted && recap.proposals_submitted > 0 && headlines.length < 4) {
    // Find the most recently proposed proposal(s) to enrich the headline
    const recentlySubmitted = activeProposals
      .filter((p) => p.proposed_epoch === recapEpoch)
      .sort((a, b) => (b.withdrawal_amount ?? 0) - (a.withdrawal_amount ?? 0));

    const newest = recentlySubmitted[0];
    let description: string;
    let href = '/governance/proposals';

    if (newest?.title && newest.withdrawal_amount && newest.withdrawal_amount > 0) {
      const amt = newest.withdrawal_amount;
      const formatted =
        amt >= 1_000_000
          ? `${(amt / 1_000_000).toFixed(1)}M`
          : amt >= 1_000
            ? `${Math.round(amt / 1_000)}K`
            : amt.toLocaleString();
      description = `"${newest.title}" \u2014 requesting ${formatted} ADA from the treasury`;
      href = `/proposal/${newest.tx_hash}?index=${newest.proposal_index}`;
    } else if (newest?.title) {
      description = `"${newest.title}" \u2014 submitted for community review`;
      href = `/proposal/${newest.tx_hash}?index=${newest.proposal_index}`;
    } else {
      description = 'The community is actively proposing changes to Cardano governance';
    }

    headlines.push({
      title: `${recap.proposals_submitted} new proposal${recap.proposals_submitted > 1 ? 's' : ''} submitted`,
      description,
      type: 'proposal',
      href,
    });
  }

  // Quiet epoch fallback
  if (headlines.length === 0) {
    headlines.push({
      title: 'Governance is running smoothly',
      description: 'A stable epoch \u2014 the network is governed and secure',
      type: 'governance',
      href: '/governance/health',
    });
  }

  return headlines;
}

// ---------------------------------------------------------------------------
// Narrative sanitizer — strip negative framing from AI-generated text
// ---------------------------------------------------------------------------

const NEGATIVE_PATTERNS = [
  /\blow\s+turnout\b/gi,
  /\bonly\s+\d+%/gi,
  /\bdeclin/gi,
  /\bfail/gi,
  /\bweak\b/gi,
  /\bpoor\b/gi,
  /\blacks?\b/gi,
  /\bstruggl/gi,
  /\bconcern/gi,
  /\bworr/gi,
  /\bapath/gi,
  /\bdisengage/gi,
  /\binactive\b/gi,
  /\bunderperform/gi,
];

/**
 * If the AI narrative contains negative framing about governance,
 * return null so it's not shown publicly. Honest assessments live
 * behind auth in the citizen briefing.
 */
function sanitizeNarrative(narrative: string | null): string | null {
  if (!narrative) return null;
  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(narrative)) return null;
  }
  return narrative;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const GET = withRouteHandler(async () => {
  const supabase = createClient();

  // Fetch recap (last completed epoch), active proposals, DRep count, treasury
  // The recap is always for the PREVIOUS epoch — it's generated on epoch transition.
  // We show it as "Epoch N" where N comes from the recap itself, not the current epoch.
  const [recapResult, activeProposalResult, drepCountResult, treasuryResult] = await Promise.all([
    supabase
      .from('epoch_recaps')
      .select(
        'epoch, proposals_submitted, proposals_ratified, proposals_expired, proposals_dropped, drep_participation_pct, treasury_withdrawn_ada, ai_narrative',
      )
      .order('epoch', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Active proposals with details for enriched headlines
    supabase
      .from('proposals')
      .select('tx_hash, proposal_index, title, proposal_type, withdrawal_amount, proposed_epoch')
      .is('ratified_epoch', null)
      .is('expired_epoch', null)
      .is('dropped_epoch', null),
    // Active DReps only (matches nav bar count)
    supabase
      .from('dreps')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('treasury_snapshots')
      .select('balance_lovelace')
      .order('epoch_no', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const recapEpoch = recapResult.data?.epoch ?? 0;
  const activeProposals = activeProposalResult.data ?? [];
  const totalDReps = drepCountResult.count ?? 0;

  // -------------------------------------------------------------------------
  // Compute lifecycle participation: % of active DReps who voted on at least
  // one currently-active proposal across its FULL lifetime (not per-epoch).
  // This is the honest metric — governance actions span ~6 epochs.
  // -------------------------------------------------------------------------
  let lifecycleParticipationPct: number | null = null;
  let totalVoters = 0;

  if (activeProposals.length > 0 && totalDReps > 0) {
    const txHashes = activeProposals.map((p) => p.tx_hash);
    const { data: voters } = await supabase
      .from('drep_votes')
      .select('drep_id')
      .in('proposal_tx_hash', txHashes);

    totalVoters = new Set((voters ?? []).map((v) => v.drep_id)).size;
    lifecycleParticipationPct = Math.round((totalVoters / totalDReps) * 1000) / 10;
  }

  const headlines = buildPublicHeadlines(
    recapResult.data,
    lifecycleParticipationPct,
    totalVoters,
    activeProposals,
    recapEpoch,
  );

  const treasuryBalanceAda = treasuryResult.data?.balance_lovelace
    ? Math.round(treasuryResult.data.balance_lovelace / 1_000_000)
    : undefined;

  // Sanitize AI narrative: strip negative framing, truncate for public
  const rawNarrative = sanitizeNarrative(recapResult.data?.ai_narrative ?? null);
  const narrative = rawNarrative
    ? rawNarrative.length > 300
      ? rawNarrative.slice(0, 300).replace(/\s+\S*$/, '') + '...'
      : rawNarrative
    : null;

  const response: PublicBriefingResponse = {
    epoch: recapEpoch,
    headline: headlines[0] ?? null,
    headlines,
    narrative,
    epochStats: {
      activeProposals: activeProposals.length,
      totalDReps,
      treasuryBalance: treasuryBalanceAda,
    },
  };

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
});
