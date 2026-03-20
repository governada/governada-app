/**
 * Catalyst Data Collection Sync
 *
 * Syncs Project Catalyst proposal, fund, campaign, and team data
 * from the Catalyst Explorer API into Supabase.
 *
 * Strategy:
 * - Initial backfill: paginate through all ~11,385 proposals
 * - Ongoing: daily incremental sync of active/recent funds only
 * - Funds and campaigns are upserted from proposal includes
 * - Team members are upserted and linked via junction table
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { SyncLogger, batchUpsert, errMsg } from '@/lib/sync-utils';
import {
  fetchCatalystFunds,
  fetchAllCatalystProposals,
  type CatalystProposal,
  type CatalystCampaign,
  type CatalystTeamMember,
  type CatalystFund,
} from '@/utils/catalyst';

/** Maximum error rate (proportion) before marking sync as failed */
const MAX_ERROR_RATE = 0.05;

// ---------------------------------------------------------------------------
// 1. Sync Funds
// ---------------------------------------------------------------------------

export async function syncCatalystFunds(): Promise<{
  fundsStored: number;
  errors: string[];
}> {
  const supabase = getSupabaseAdmin();
  const syncLog = new SyncLogger(supabase, 'catalyst_funds');
  await syncLog.start();
  const errors: string[] = [];

  try {
    const funds = await fetchCatalystFunds();
    const rows = funds.map(toFundRow);

    const result = await batchUpsert(supabase, 'catalyst_funds', rows, 'id', 'catalyst_funds');
    if (result.errors > 0) errors.push(`${result.errors} fund upsert errors`);

    await syncLog.finalize(errors.length === 0, errors.join('; ') || null, {
      funds_stored: result.success,
    });

    return { fundsStored: result.success, errors };
  } catch (err) {
    const msg = errMsg(err);
    errors.push(msg);
    await syncLog.finalize(false, msg, {});
    logger.error('[catalyst] Fund sync failed', { error: msg });
    return { fundsStored: 0, errors };
  }
}

// ---------------------------------------------------------------------------
// 2. Sync Proposals (with campaigns and team members)
// ---------------------------------------------------------------------------

export async function syncCatalystProposals(fundId?: string): Promise<{
  proposalsStored: number;
  campaignsStored: number;
  teamMembersStored: number;
  teamLinksStored: number;
  errors: string[];
}> {
  const supabase = getSupabaseAdmin();
  const errors: string[] = [];

  let proposalsStored = 0;
  let campaignsStored = 0;
  let teamMembersStored = 0;
  let teamLinksStored = 0;

  // Deduplicate campaigns and team members across pages
  // Campaign map stores [campaign, fund_id] to populate the FK
  const seenCampaigns = new Map<string, { campaign: CatalystCampaign; fundId: string | null }>();
  const seenTeamMembers = new Map<string, CatalystTeamMember>();
  const teamLinks: Array<{ proposal_id: string; team_member_id: string }> = [];
  let totalRecords = 0;
  let totalCampaignsAttempted = 0;

  try {
    // Ensure funds exist first (for FK references)
    const { data: existingFunds } = await supabase.from('catalyst_funds').select('id').limit(1);

    if (!existingFunds || existingFunds.length === 0) {
      logger.info('[catalyst] No funds in DB, syncing funds first');
      await syncCatalystFunds();
    }

    // Process proposals page by page
    let pageCount = 0;
    for await (const proposals of fetchAllCatalystProposals(fundId)) {
      pageCount++;

      totalRecords += proposals.length;

      // Extract campaigns from this page (with fund_id derived from proposal)
      for (const p of proposals) {
        if (p.campaign) {
          seenCampaigns.set(p.campaign.id, {
            campaign: p.campaign,
            fundId: p.fund?.id ?? null,
          });
        }
        // Extract team members and build junction links
        if (p.team) {
          for (const member of p.team) {
            seenTeamMembers.set(member.id, member);
            teamLinks.push({ proposal_id: p.id, team_member_id: member.id });
          }
        }
      }

      // Flush campaigns before proposals to satisfy FK constraint
      if (seenCampaigns.size > 0) {
        totalCampaignsAttempted += seenCampaigns.size;
        const campaignResult = await flushCampaigns(supabase, seenCampaigns);
        campaignsStored += campaignResult;
        seenCampaigns.clear();
      }

      // Upsert proposals for this page
      const proposalRows = proposals.map(toProposalRow);
      const result = await batchUpsert(
        supabase,
        'catalyst_proposals',
        proposalRows,
        'id',
        'catalyst_proposals',
      );
      proposalsStored += result.success;
      if (result.errors > 0) errors.push(`Page ${pageCount}: ${result.errors} proposal errors`);

      if (pageCount % 10 === 0) {
        logger.info('[catalyst] Sync progress', { pages: pageCount, proposals: proposalsStored });
      }
    }

    // Flush remaining campaigns
    if (seenCampaigns.size > 0) {
      totalCampaignsAttempted += seenCampaigns.size;
      campaignsStored += await flushCampaigns(supabase, seenCampaigns);
    }

    // Upsert team members
    if (seenTeamMembers.size > 0) {
      const memberRows = Array.from(seenTeamMembers.values()).map(toTeamMemberRow);
      const memberResult = await batchUpsert(
        supabase,
        'catalyst_team_members',
        memberRows,
        'id',
        'catalyst_team_members',
      );
      teamMembersStored = memberResult.success;
      if (memberResult.errors > 0) errors.push(`${memberResult.errors} team member upsert errors`);
    }

    // Upsert junction links
    if (teamLinks.length > 0) {
      const linkResult = await batchUpsert(
        supabase,
        'catalyst_proposal_team',
        teamLinks,
        'proposal_id,team_member_id',
        'catalyst_proposal_team',
      );
      teamLinksStored = linkResult.success;
      if (linkResult.errors > 0) errors.push(`${linkResult.errors} team link errors`);
    }

    // Check error rate across all record types
    const totalAttempted =
      totalRecords + seenTeamMembers.size + teamLinks.length + totalCampaignsAttempted;
    const totalStored = proposalsStored + teamMembersStored + teamLinksStored + campaignsStored;
    const errorCount = totalAttempted > 0 ? totalAttempted - totalStored : 0;
    const errorRate = totalAttempted > 0 ? errorCount / totalAttempted : 0;

    if (errorRate >= MAX_ERROR_RATE) {
      logger.warn('[catalyst] Error rate exceeded threshold', {
        errorRate: `${(errorRate * 100).toFixed(1)}%`,
        threshold: `${(MAX_ERROR_RATE * 100).toFixed(0)}%`,
        totalAttempted,
        totalStored,
        errorCount,
      });
      errors.push(
        `Error rate ${(errorRate * 100).toFixed(1)}% exceeds ${(MAX_ERROR_RATE * 100).toFixed(0)}% threshold`,
      );
    }

    logger.info('[catalyst] Sync complete', {
      proposalsStored,
      campaignsStored,
      teamMembersStored,
      teamLinksStored,
    });

    return { proposalsStored, campaignsStored, teamMembersStored, teamLinksStored, errors };
  } catch (err) {
    const msg = errMsg(err);
    errors.push(msg);
    logger.error('[catalyst] Proposal sync failed', { error: msg });
    return { proposalsStored, campaignsStored, teamMembersStored, teamLinksStored, errors };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toFundRow(f: CatalystFund) {
  return {
    id: f.id,
    title: f.title,
    slug: f.slug ?? null,
    status: f.status ?? null,
    currency: f.currency ?? null,
    currency_symbol: f.currency_symbol ?? null,
    amount: f.amount ?? null,
    launched_at: f.launched_at,
    awarded_at: f.awarded_at,
    hero_img_url: f.hero_img_url,
    banner_img_url: f.banner_img_url,
    proposals_count: f.proposals_count ?? null,
    funded_count: f.funded_proposals_count ?? null,
    completed_count: f.completed_proposals_count ?? null,
    synced_at: new Date().toISOString(),
  };
}

function toProposalRow(p: CatalystProposal) {
  return {
    id: p.id,
    fund_id: p.fund?.id ?? null,
    campaign_id: p.campaign?.id ?? null,
    title: p.title,
    slug: p.slug,
    status: p.status,
    funding_status: p.funding_status,
    yes_votes_count: p.yes_votes_count,
    no_votes_count: p.no_votes_count,
    abstain_votes_count: p.abstain_votes_count,
    amount_requested: p.amount_requested,
    amount_received: p.amount_received,
    currency: p.currency,
    problem: p.problem,
    solution: p.solution,
    experience: p.experience,
    project_details: p.project_details,
    alignment_score: p.alignment_score,
    feasibility_score: p.feasibility_score,
    auditability_score: p.auditability_score,
    website: p.website,
    opensource: p.opensource ?? false,
    project_length: p.project_length,
    funded_at: p.funded_at,
    link: p.link,
    chain_proposal_id: p.chain_proposal_id,
    chain_proposal_index: p.chain_proposal_index,
    ideascale_id: p.ideascale_id != null ? String(p.ideascale_id) : null,
    unique_wallets: p.unique_wallets,
    yes_wallets: p.yes_wallets,
    no_wallets: p.no_wallets,
    synced_at: new Date().toISOString(),
  };
}

function toTeamMemberRow(m: CatalystTeamMember) {
  return {
    id: m.id,
    username: m.username ?? null,
    name: m.name ?? null,
    bio: m.bio ?? null,
    twitter: m.twitter ?? null,
    linkedin: m.linkedin ?? null,
    discord: m.discord ?? null,
    ideascale: m.ideascale ?? null,
    telegram: m.telegram ?? null,
    hero_img_url: m.hero_img_url ?? null,
    submitted_proposals: m.submitted_proposals ?? null,
    funded_proposals: m.funded_proposals ?? null,
    completed_proposals: m.completed_proposals ?? null,
    synced_at: new Date().toISOString(),
  };
}

async function flushCampaigns(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  campaigns: Map<string, { campaign: CatalystCampaign; fundId: string | null }>,
): Promise<number> {
  if (campaigns.size === 0) return 0;
  const rows = Array.from(campaigns.values()).map(({ campaign: c, fundId }) => ({
    id: c.id,
    title: c.title,
    slug: c.slug ?? null,
    excerpt: c.excerpt ?? null,
    amount: c.amount ?? null,
    fund_id: fundId,
    launched_at: c.launched_at,
    awarded_at: c.awarded_at,
    synced_at: new Date().toISOString(),
  }));
  const result = await batchUpsert(
    supabase,
    'catalyst_campaigns',
    rows,
    'id',
    'catalyst_campaigns',
  );
  return result.success;
}
