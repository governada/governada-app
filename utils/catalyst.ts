/**
 * Catalyst Explorer API client
 *
 * Fetches Project Catalyst proposal, fund, and campaign data
 * from the public Catalyst Explorer API.
 *
 * API docs: https://www.catalystexplorer.com/api/v1/
 */

import { logger } from '@/lib/logger';

const BASE_URL = 'https://www.catalystexplorer.com/api/v1';
const REQUEST_DELAY_MS = 300; // Be respectful to the API
const MAX_PER_PAGE = 60; // API maximum

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CatalystFund {
  id: string;
  title: string;
  slug: string;
  label: string | null;
  description: string | null;
  status: string | null;
  currency: string | null;
  currency_symbol: string | null;
  amount: number | null;
  launched_at: string | null;
  awarded_at: string | null;
  assessment_started_at: string | null;
  hero_img_url: string | null;
  banner_img_url: string | null;
  proposals_count: number | null;
  funded_proposals_count: number | null;
  completed_proposals_count: number | null;
}

export interface CatalystCampaign {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  amount: number | null;
  launched_at: string | null;
  awarded_at: string | null;
  color: string | null;
  label: string | null;
}

export interface CatalystTeamMember {
  id: string;
  username: string | null;
  name: string | null;
  bio: string | null;
  twitter: string | null;
  linkedin: string | null;
  discord: string | null;
  ideascale: string | null;
  telegram: string | null;
  hero_img_url: string | null;
  submitted_proposals: number | null;
  funded_proposals: number | null;
  completed_proposals: number | null;
}

export interface CatalystProposal {
  id: string;
  title: string;
  slug: string;
  status: string | null;
  funding_status: string | null;
  yes_votes_count: number | null;
  no_votes_count: number | null;
  abstain_votes_count: number | null;
  amount_requested: number | null;
  amount_received: number | null;
  currency: string | null;
  problem: string | null;
  solution: string | null;
  experience: string | null;
  project_details: Record<string, unknown> | null;
  alignment_score: number | null;
  feasibility_score: number | null;
  auditability_score: number | null;
  website: string | null;
  opensource: boolean | null;
  project_length: string | null;
  funded_at: string | null;
  link: string | null;
  chain_proposal_id: string | null;
  chain_proposal_index: number | null;
  ideascale_id: string | number | null;
  unique_wallets: number | null;
  yes_wallets: number | null;
  no_wallets: number | null;
  fund?: CatalystFund;
  campaign?: CatalystCampaign;
  team?: CatalystTeamMember[];
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------

async function catalystFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Catalyst API ${res.status}: ${endpoint}`);
  }

  return res.json() as Promise<T>;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all Catalyst funds (14 rounds).
 */
export async function fetchCatalystFunds(): Promise<CatalystFund[]> {
  const response = await catalystFetch<{ data: CatalystFund[] }>('/funds');
  return response.data;
}

/**
 * Fetch proposals with pagination. Returns all proposals when called with
 * fetchAllCatalystProposals(). Each proposal includes fund, campaign, and team.
 */
export async function fetchCatalystProposalsPage(
  page: number,
  fundId?: string,
): Promise<PaginatedResponse<CatalystProposal>> {
  const params: Record<string, string> = {
    per_page: String(MAX_PER_PAGE),
    page: String(page),
    include: 'fund,campaign,team',
  };
  if (fundId) {
    params['filter[fund_id]'] = fundId;
  }
  return catalystFetch<PaginatedResponse<CatalystProposal>>('/proposals', params);
}

/**
 * Paginate through ALL proposals. Yields pages to allow streaming processing.
 */
export async function* fetchAllCatalystProposals(
  fundId?: string,
): AsyncGenerator<CatalystProposal[], void, unknown> {
  let page = 1;
  let lastPage = 1;

  do {
    const response = await fetchCatalystProposalsPage(page, fundId);
    lastPage = response.meta.last_page;

    if (page === 1) {
      logger.info('[catalyst] Starting proposal fetch', {
        total: response.meta.total,
        pages: lastPage,
        fundId: fundId ?? 'all',
      });
    }

    yield response.data;
    page++;

    if (page <= lastPage) {
      await delay(REQUEST_DELAY_MS);
    }
  } while (page <= lastPage);
}
