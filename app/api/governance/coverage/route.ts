/**
 * Governance Coverage API
 *
 * Returns a citizen's governance coverage — how many of the 7 governance
 * action types are covered by their DRep + pool delegations.
 *
 * DReps cover 5 types: NoConfidence, NewConstitution, UpdateCommittee,
 * TreasuryWithdrawals, InfoAction.
 * SPOs cover 2 types: HardForkInitiation, ProtocolParameterChange.
 *
 * Full coverage = active DRep + governance-active pool.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const KOIOS_BASE = process.env.NEXT_PUBLIC_KOIOS_BASE_URL || 'https://api.koios.rest/api/v1';

const TOTAL_TYPES = 7;
const DREP_TYPES = 5;
const SPO_TYPES = 2;

interface CoverageAlert {
  type: 'drep_inactive' | 'pool_not_voting' | 'no_drep' | 'no_pool';
  message: string;
}

export const GET = withRouteHandler(async (request: NextRequest) => {
  const stakeAddress = request.nextUrl.searchParams.get('stakeAddress');

  if (!stakeAddress) {
    return NextResponse.json({ error: 'Required: stakeAddress' }, { status: 400 });
  }

  // 1. Get delegation info from Koios
  let delegatedDrep: string | null = null;
  let delegatedPool: string | null = null;

  try {
    const accountRes = await fetch(`${KOIOS_BASE}/account_info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _stake_addresses: [stakeAddress] }),
      signal: AbortSignal.timeout(10_000),
    });

    if (accountRes.ok) {
      const accounts = (await accountRes.json()) as Array<{
        delegated_pool?: string;
        delegated_drep?: string;
      }>;
      const account = accounts[0];
      if (account) {
        delegatedPool = account.delegated_pool ?? null;
        delegatedDrep = account.delegated_drep ?? null;
      }
    }
  } catch {
    // If Koios fails, we return with everything uncovered
  }

  // 2. Check pool governance activity from Supabase
  const supabase = createClient();
  let poolIsGovActive = false;
  let poolVoteCount = 0;

  if (delegatedPool) {
    const { data: pool } = await supabase
      .from('pools')
      .select('vote_count')
      .eq('pool_id', delegatedPool)
      .single();

    poolVoteCount = (pool?.vote_count as number) ?? 0;
    poolIsGovActive = poolVoteCount > 0;
  }

  // 3. Check DRep status — is the DRep active?
  const hasDrep = !!delegatedDrep;
  const hasPool = !!delegatedPool;
  let drepIsActive = true; // Assume active if delegated

  if (delegatedDrep) {
    const { data: drep } = await supabase
      .from('dreps')
      .select('active')
      .eq('id', delegatedDrep)
      .single();

    if (drep) {
      drepIsActive = drep.active !== false;
    }
  }

  // 4. Calculate coverage
  const drepCovered = hasDrep && drepIsActive ? DREP_TYPES : 0;
  const poolCovered = hasPool && poolIsGovActive ? SPO_TYPES : 0;
  const coveredTypes = drepCovered + poolCovered;
  const coveragePct = Math.round((coveredTypes / TOTAL_TYPES) * 100);

  // 5. Build gaps and alerts
  const gaps: string[] = [];
  const alerts: CoverageAlert[] = [];

  if (!hasDrep) {
    gaps.push('No DRep delegation');
    alerts.push({
      type: 'no_drep',
      message: 'Your ADA has no voice on treasury, committee, or constitutional votes',
    });
  } else if (!drepIsActive) {
    gaps.push('DRep is inactive');
    alerts.push({
      type: 'drep_inactive',
      message: 'Your delegated DRep is no longer active — consider re-delegating',
    });
  }

  if (!hasPool) {
    gaps.push('No stake pool');
    alerts.push({
      type: 'no_pool',
      message: 'You have no representation on protocol parameters or hard forks',
    });
  } else if (!poolIsGovActive) {
    gaps.push('Pool not voting');
    alerts.push({
      type: 'pool_not_voting',
      message:
        "Your pool hasn't voted on governance — consider a governance-active pool for full coverage",
    });
  }

  return NextResponse.json(
    {
      coveredTypes,
      totalTypes: TOTAL_TYPES,
      coveragePct,
      hasDrep,
      hasPool,
      poolIsGovActive,
      drepIsActive,
      gaps,
      alerts,
    },
    {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' },
    },
  );
});
