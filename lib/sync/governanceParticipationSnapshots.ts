import type { getSupabaseAdmin } from '@/lib/supabase';
import { errMsg, fetchAll } from '@/lib/sync-utils';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type QueryError = {
  message: string;
} | null;

type DrepVoteRow = {
  drep_id: string | null;
};

type DrepPowerInfoRow = {
  id: string;
  info: Record<string, unknown> | null;
};

type ExistingSnapshotRow = {
  active_drep_count: number | null;
  epoch: number;
  participation_rate: number | null;
  rationale_rate: number | null;
  total_drep_count: number | null;
  total_voting_power_lovelace: string | null;
};

export type GovernanceParticipationSnapshotResult = {
  activeDreps: number;
  epoch: number;
  inserted: boolean;
  participationRate: number;
  rationaleRate: number;
  skipped: boolean;
  totalDreps: number;
  totalVotingPowerLovelace: string;
};

export type GovernanceParticipationBackfillResult = {
  fromEpoch: number;
  inserted: number;
  results: GovernanceParticipationSnapshotResult[];
  skipped: number;
  toEpoch: number;
};

function assertNoQueryError(label: string, error: QueryError): void {
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
}

function roundPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function getVotingPowerLovelace(info: Record<string, unknown> | null): bigint {
  const raw = info?.votingPowerLovelace;

  if (typeof raw === 'string' && /^\d+$/u.test(raw)) {
    return BigInt(raw);
  }

  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return BigInt(Math.trunc(raw));
  }

  return BigInt(0);
}

async function ensureGovernanceParticipationCompletenessLog(
  supabase: SupabaseAdminClient,
  epoch: number,
  participationRate: number,
): Promise<void> {
  const { error: completenessError } = await supabase.from('snapshot_completeness_log').upsert(
    {
      snapshot_type: 'governance_participation',
      epoch_no: epoch,
      snapshot_date: new Date().toISOString().slice(0, 10),
      record_count: 1,
      expected_count: 1,
      coverage_pct: 100,
      metadata: { participation_rate: participationRate },
    },
    { onConflict: 'snapshot_type,epoch_no,snapshot_date' },
  );
  assertNoQueryError(
    'snapshot_completeness_log governance_participation upsert',
    completenessError,
  );
}

export async function ensureGovernanceParticipationSnapshot(
  supabase: SupabaseAdminClient,
  epoch: number,
): Promise<GovernanceParticipationSnapshotResult> {
  if (!Number.isInteger(epoch) || epoch <= 0) {
    throw new Error(`Invalid governance participation snapshot epoch: ${epoch}`);
  }

  const existingResult = await supabase
    .from('governance_participation_snapshots')
    .select(
      'epoch, active_drep_count, total_drep_count, participation_rate, rationale_rate, total_voting_power_lovelace',
    )
    .eq('epoch', epoch)
    .maybeSingle();
  assertNoQueryError('governance_participation_snapshots existing check', existingResult.error);

  if (existingResult.data) {
    const existing = existingResult.data as ExistingSnapshotRow;
    const participationRate = existing.participation_rate ?? 0;
    await ensureGovernanceParticipationCompletenessLog(supabase, epoch, participationRate);

    return {
      activeDreps: existing.active_drep_count ?? 0,
      epoch,
      inserted: false,
      participationRate,
      rationaleRate: existing.rationale_rate ?? 0,
      skipped: true,
      totalDreps: existing.total_drep_count ?? 0,
      totalVotingPowerLovelace: existing.total_voting_power_lovelace ?? '0',
    };
  }

  const [votersResult, drepInfoRows, rationaleResult] = await Promise.all([
    supabase.from('drep_votes').select('drep_id').eq('epoch_no', epoch),
    fetchAll<DrepPowerInfoRow>(() =>
      supabase.from('dreps').select('id, info').eq('is_active', true),
    ),
    supabase
      .from('drep_votes')
      .select('vote_tx_hash', { count: 'exact', head: true })
      .eq('epoch_no', epoch)
      .eq('has_rationale', true),
  ]);

  assertNoQueryError('drep_votes participation query', votersResult.error);
  assertNoQueryError('drep_votes rationale query', rationaleResult.error);

  const activeDrepIds = new Set(drepInfoRows.map((row) => row.id));
  const voterRows = (votersResult.data ?? []) as DrepVoteRow[];
  const uniqueVoters = new Set(
    voterRows
      .map((vote) => vote.drep_id)
      .filter(
        (drepId): drepId is string =>
          typeof drepId === 'string' && drepId.length > 0 && activeDrepIds.has(drepId),
      ),
  );

  const activeDreps = uniqueVoters.size;
  const totalDreps = drepInfoRows.length || 1;
  const totalVotes = voterRows.length;
  const participationRate = roundPercent(activeDreps, totalDreps);
  const rationaleRate = roundPercent(rationaleResult.count ?? 0, totalVotes);
  const totalVotingPower = drepInfoRows.reduce(
    (sum, row) => sum + getVotingPowerLovelace(row.info),
    BigInt(0),
  );

  const { error: snapshotError } = await supabase.from('governance_participation_snapshots').upsert(
    {
      epoch,
      active_drep_count: activeDreps,
      total_drep_count: totalDreps,
      participation_rate: participationRate,
      rationale_rate: rationaleRate,
      total_voting_power_lovelace: totalVotingPower.toString(),
    },
    { onConflict: 'epoch' },
  );
  assertNoQueryError('governance_participation_snapshots upsert', snapshotError);

  await ensureGovernanceParticipationCompletenessLog(supabase, epoch, participationRate);

  return {
    activeDreps,
    epoch,
    inserted: true,
    participationRate,
    rationaleRate,
    skipped: false,
    totalDreps,
    totalVotingPowerLovelace: totalVotingPower.toString(),
  };
}

export async function backfillMissingGovernanceParticipationSnapshots(
  supabase: SupabaseAdminClient,
  fromEpoch: number,
  toEpoch: number,
): Promise<GovernanceParticipationBackfillResult> {
  if (toEpoch < fromEpoch) {
    return { fromEpoch, inserted: 0, results: [], skipped: 0, toEpoch };
  }

  const results: GovernanceParticipationSnapshotResult[] = [];

  for (let epoch = fromEpoch; epoch <= toEpoch; epoch++) {
    try {
      results.push(await ensureGovernanceParticipationSnapshot(supabase, epoch));
    } catch (error) {
      throw new Error(`governance_participation_snapshots epoch ${epoch}: ${errMsg(error)}`);
    }
  }

  return {
    fromEpoch,
    inserted: results.filter((result) => result.inserted).length,
    results,
    skipped: results.filter((result) => result.skipped).length,
    toEpoch,
  };
}
