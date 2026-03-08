/**
 * Cross-Chain Governance Intelligence
 *
 * Adapters for Tally (Ethereum) and SubSquare (Polkadot) APIs
 * that fetch chain-native metrics for the Governance Observatory.
 */

import { logger } from '@/lib/logger';
import { withRetry } from '@/lib/retry';

export type Chain = 'cardano' | 'ethereum' | 'polkadot';

export interface ChainBenchmark {
  chain: Chain;
  periodLabel: string;
  participationRate: number | null;
  delegateCount: number | null;
  proposalCount: number | null;
  proposalThroughput: number | null;
  avgRationaleRate: number | null;
  rawData: Record<string, unknown>;
  fetchedAt: string;
}

export interface ChainIdentity {
  chain: Chain;
  name: string;
  color: string;
  logo: string;
}

export const CHAIN_IDENTITIES: Record<Chain, ChainIdentity> = {
  cardano: { chain: 'cardano', name: 'Cardano', color: '#06b6d4', logo: '/chains/cardano.svg' },
  ethereum: { chain: 'ethereum', name: 'Ethereum', color: '#a855f7', logo: '/chains/ethereum.svg' },
  polkadot: { chain: 'polkadot', name: 'Polkadot', color: '#ec4899', logo: '/chains/polkadot.svg' },
};

/**
 * Wrapper that maps shared withRetry (throws on exhaustion) to the
 * null-on-failure contract used by the cross-chain adapters.
 */
async function withRetrySafe<T>(fn: () => Promise<T>, label: string): Promise<T | null> {
  try {
    return await withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 2000,
      label,
    });
  } catch (err) {
    logger.error(`[crossChain] ${label} failed after all retries`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tally adapter (Ethereum)
// ---------------------------------------------------------------------------

const TALLY_API_URL = 'https://api.tally.xyz/query';

const TALLY_ORGS_QUERY = `
  query TopOrgs {
    organizations(input: { sort: { field: POPULAR, order: DESC }, page: { limit: 20 } }) {
      nodes {
        ... on Organization {
          id
          slug
          name
          delegatesCount
          delegatesVotesCount
          tokenOwnersCount
          proposalsCount
          hasActiveProposals
        }
      }
    }
  }
`;

const TALLY_ORG_PROPOSALS_QUERY = `
  query OrgProposals($slug: String!) {
    proposals(input: { organizationSlug: $slug, page: { limit: 20 }, sort: { field: START_BLOCK, order: DESC } }) {
      nodes {
        ... on Proposal {
          id
          status
          voteStats {
            type
            votesCount
            votersCount
            percent
          }
        }
      }
    }
  }
`;

interface TallyOrgNode {
  slug: string;
  name: string;
  delegatesCount: number;
  delegatesVotesCount: number;
  tokenOwnersCount: number;
  proposalsCount: number;
}

async function tallyFetch(query: string, variables?: Record<string, unknown>): Promise<unknown> {
  const apiKey = process.env.TALLY_API_KEY;
  if (!apiKey) {
    logger.warn('[crossChain] TALLY_API_KEY not set, skipping Ethereum fetch');
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(TALLY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': apiKey,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      const msg = `Tally API error: ${res.status} ${res.statusText}`;
      if (res.status >= 500 || res.status === 429) throw new Error(msg);
      logger.error('[crossChain] Tally API error', {
        status: res.status,
        statusText: res.statusText,
      });
      return null;
    }

    const json = await res.json();
    if (json.errors) {
      logger.error('[crossChain] Tally GraphQL errors', { errors: json.errors });
      return null;
    }

    return json.data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchEthereumBenchmark(): Promise<ChainBenchmark | null> {
  const orgsData = (await withRetrySafe(
    () => tallyFetch(TALLY_ORGS_QUERY),
    'crossChain/tally/orgs',
  )) as {
    organizations?: { nodes: TallyOrgNode[] };
  } | null;
  if (!orgsData?.organizations?.nodes?.length) return null;

  const orgs = orgsData.organizations.nodes;

  const totalDelegates = orgs.reduce((s, o) => s + (o.delegatesCount || 0), 0);
  const totalProposals = orgs.reduce((s, o) => s + (o.proposalsCount || 0), 0);
  const totalTokenOwners = orgs.reduce((s, o) => s + (o.tokenOwnersCount || 0), 0);

  const topSlug = orgs[0]?.slug;
  let participationRate: number | null = null;
  let proposalThroughput: number | null = null;

  if (topSlug) {
    const proposalsData = (await withRetrySafe(
      () => tallyFetch(TALLY_ORG_PROPOSALS_QUERY, { slug: topSlug }),
      'crossChain/tally/proposals',
    )) as {
      proposals?: { nodes: { status: string; voteStats: { votersCount: number }[] }[] };
    } | null;

    if (proposalsData?.proposals?.nodes?.length) {
      const props = proposalsData.proposals.nodes;
      const withVotes = props.filter((p) => p.voteStats?.some((v) => v.votersCount > 0));
      proposalThroughput = Math.round((withVotes.length / props.length) * 100);

      const avgVoters =
        withVotes.reduce((s, p) => {
          const total = p.voteStats.reduce((vs, v) => vs + v.votersCount, 0);
          return s + total;
        }, 0) / Math.max(withVotes.length, 1);

      participationRate =
        totalDelegates > 0 ? Math.min(100, Math.round((avgVoters / totalDelegates) * 100)) : null;
    }
  }

  const now = new Date();
  const periodLabel = `${now.getFullYear()}-W${String(getISOWeek(now)).padStart(2, '0')}`;

  return {
    chain: 'ethereum',
    periodLabel,
    participationRate,
    delegateCount: totalDelegates,
    proposalCount: totalProposals,
    proposalThroughput,
    avgRationaleRate: null,
    rawData: {
      orgs: orgs.map((o) => ({
        slug: o.slug,
        name: o.name,
        delegates: o.delegatesCount,
        proposals: o.proposalsCount,
      })),
      totalTokenOwners,
    },
    fetchedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// SubSquare adapter (Polkadot)
// ---------------------------------------------------------------------------

const SUBSQUARE_BASE = 'https://polkadot.subsquare.io/api';

async function subsquareFetch(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(`${SUBSQUARE_BASE}${path}`, {
      headers: { Accept: 'application/json', Referer: 'https://polkadot.subsquare.io/' },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      const msg = `SubSquare API error: ${res.status} ${res.statusText}`;
      if (res.status >= 500 || res.status === 429) throw new Error(msg);
      logger.error('[crossChain] SubSquare API error', {
        status: res.status,
        statusText: res.statusText,
      });
      return null;
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchPolkadotBenchmark(): Promise<ChainBenchmark | null> {
  const [summaryData, referendaData] = await Promise.all([
    withRetrySafe(() => subsquareFetch('/summary'), 'crossChain/subsquare/summary'),
    withRetrySafe(
      () => subsquareFetch('/gov2/referendums?page=1&page_size=20'),
      'crossChain/subsquare/referenda',
    ),
  ]);

  const summary = summaryData as {
    gov2Referenda?: { all?: number; active?: number };
    gov2ReferendaTracks?: { id: number; name: string; activeCount: number }[];
    fellowshipReferenda?: { all?: number };
  } | null;

  const referenda = referendaData as {
    items?: {
      state?: { name: string };
      onchainData?: { tally?: { ayes: string; nays: string } };
    }[];
    total?: number;
  } | null;

  if (!summary && !referenda) return null;

  const totalReferenda = summary?.gov2Referenda?.all ?? referenda?.total ?? 0;
  const activeReferenda = summary?.gov2Referenda?.active ?? 0;
  const activeTracks =
    summary?.gov2ReferendaTracks?.filter((t) => t.activeCount > 0).length ?? null;

  let proposalThroughput: number | null = null;
  let participationRate: number | null = null;

  if (referenda?.items?.length) {
    const withVotes = referenda.items.filter((r) => {
      const ayes = parseInt(r.onchainData?.tally?.ayes || '0', 10);
      const nays = parseInt(r.onchainData?.tally?.nays || '0', 10);
      return ayes + nays > 0;
    });
    proposalThroughput = Math.round((withVotes.length / referenda.items.length) * 100);
  }

  // Participation rate: active referenda as % of total (approximate engagement metric)
  participationRate =
    totalReferenda > 0 ? Math.min(100, Math.round((activeReferenda / totalReferenda) * 100)) : null;

  const now = new Date();
  const periodLabel = `${now.getFullYear()}-W${String(getISOWeek(now)).padStart(2, '0')}`;

  return {
    chain: 'polkadot',
    periodLabel,
    participationRate,
    delegateCount: null,
    proposalCount: totalReferenda,
    proposalThroughput,
    avgRationaleRate: null,
    rawData: { summary, activeTracks, recentReferendaCount: referenda?.items?.length ?? 0 },
    fetchedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Cardano adapter (reads from existing GHI)
// ---------------------------------------------------------------------------

export async function fetchCardanoBenchmark(): Promise<ChainBenchmark | null> {
  const { computeGHI } = await import('./ghi');
  const { createClient } = await import('./supabase');

  try {
    const ghi = await computeGHI();
    const supabase = createClient();

    const [drepsRes, proposalsRes, epochRes] = await Promise.all([
      supabase.from('dreps').select('id, info', { count: 'exact', head: true }),
      supabase.from('proposals').select('tx_hash', { count: 'exact', head: true }),
      supabase.from('governance_stats').select('current_epoch').eq('id', 1).single(),
    ]);

    const activeDrepCount = drepsRes.count ?? 0;
    const proposalCount = proposalsRes.count ?? 0;
    const epoch = epochRes.data?.current_epoch ?? 0;

    const participationComp = ghi.components.find((c) => c.name === 'Participation');
    const rationaleComp = ghi.components.find((c) => c.name === 'Rationale');
    const throughputComp = ghi.components.find((c) => c.name === 'Proposal Throughput');

    const now = new Date();
    const periodLabel =
      epoch > 0
        ? `epoch-${epoch}`
        : `${now.getFullYear()}-W${String(getISOWeek(now)).padStart(2, '0')}`;

    return {
      chain: 'cardano',
      periodLabel,
      participationRate: participationComp?.value ?? null,
      delegateCount: activeDrepCount,
      proposalCount,
      proposalThroughput: throughputComp?.value ?? null,
      avgRationaleRate: rationaleComp?.value ?? null,
      rawData: { ghiScore: ghi.score, ghiBand: ghi.band, components: ghi.components },
      fetchedAt: now.toISOString(),
    };
  } catch (err) {
    logger.error('[crossChain] Cardano benchmark fetch failed', { error: err });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
