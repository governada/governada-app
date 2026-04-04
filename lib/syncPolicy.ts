export type SyncHealthLevel = 'healthy' | 'degraded' | 'critical';

export interface SyncPolicy {
  label: string;
  schedule: string;
  cadenceMinutes: number;
  retriggerAfterMinutes: number;
  degradedAfterMinutes: number;
  criticalAfterMinutes: number;
  externalCriticalAfterMinutes: number;
  event?: string;
  core?: boolean;
}

const HOUR = 60;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export const SYNC_POLICY: Record<string, SyncPolicy> = {
  proposals: {
    label: 'Proposals Sync',
    schedule: 'every 30m',
    cadenceMinutes: 30,
    retriggerAfterMinutes: 90,
    degradedAfterMinutes: 90,
    criticalAfterMinutes: 180,
    externalCriticalAfterMinutes: 120,
    event: 'drepscore/sync.proposals',
    core: true,
  },
  dreps: {
    label: 'DReps Sync',
    schedule: 'every 6h',
    cadenceMinutes: 6 * HOUR,
    retriggerAfterMinutes: 8 * HOUR,
    degradedAfterMinutes: 12 * HOUR,
    criticalAfterMinutes: 24 * HOUR,
    externalCriticalAfterMinutes: 12 * HOUR,
    event: 'drepscore/sync.dreps',
    core: true,
  },
  votes: {
    label: 'Votes Sync',
    schedule: 'every 6h',
    cadenceMinutes: 6 * HOUR,
    retriggerAfterMinutes: 8 * HOUR,
    degradedAfterMinutes: 12 * HOUR,
    criticalAfterMinutes: 24 * HOUR,
    externalCriticalAfterMinutes: 12 * HOUR,
    event: 'drepscore/sync.votes',
  },
  secondary: {
    label: 'Secondary Sync',
    schedule: 'every 6h',
    cadenceMinutes: 6 * HOUR,
    retriggerAfterMinutes: 8 * HOUR,
    degradedAfterMinutes: 48 * HOUR,
    criticalAfterMinutes: 96 * HOUR,
    externalCriticalAfterMinutes: 48 * HOUR,
    event: 'drepscore/sync.secondary',
  },
  slow: {
    label: 'Slow Sync',
    schedule: 'daily',
    cadenceMinutes: DAY,
    retriggerAfterMinutes: 30 * HOUR,
    degradedAfterMinutes: 48 * HOUR,
    criticalAfterMinutes: 96 * HOUR,
    externalCriticalAfterMinutes: 48 * HOUR,
    event: 'drepscore/sync.slow',
  },
  treasury: {
    label: 'Treasury Sync',
    schedule: 'daily',
    cadenceMinutes: DAY,
    retriggerAfterMinutes: 25 * HOUR,
    degradedAfterMinutes: 48 * HOUR,
    criticalAfterMinutes: 96 * HOUR,
    externalCriticalAfterMinutes: 48 * HOUR,
    event: 'drepscore/sync.treasury',
  },
  full: {
    label: 'Full Sync',
    schedule: 'daily',
    cadenceMinutes: DAY,
    retriggerAfterMinutes: 26 * HOUR,
    degradedAfterMinutes: 26 * HOUR,
    criticalAfterMinutes: 52 * HOUR,
    externalCriticalAfterMinutes: 26 * HOUR,
  },
  scoring: {
    label: 'Scoring Sync',
    schedule: 'every 6h',
    cadenceMinutes: 6 * HOUR,
    retriggerAfterMinutes: 8 * HOUR,
    degradedAfterMinutes: 12 * HOUR,
    criticalAfterMinutes: 24 * HOUR,
    externalCriticalAfterMinutes: 12 * HOUR,
    event: 'drepscore/sync.scores',
    core: true,
  },
  alignment: {
    label: 'Alignment Sync',
    schedule: 'every 6h',
    cadenceMinutes: 6 * HOUR,
    retriggerAfterMinutes: 8 * HOUR,
    degradedAfterMinutes: 12 * HOUR,
    criticalAfterMinutes: 24 * HOUR,
    externalCriticalAfterMinutes: 12 * HOUR,
    event: 'drepscore/sync.alignment',
    core: true,
  },
  ghi: {
    label: 'GHI Sync',
    schedule: 'daily',
    cadenceMinutes: DAY,
    retriggerAfterMinutes: 25 * HOUR,
    degradedAfterMinutes: 48 * HOUR,
    criticalAfterMinutes: 96 * HOUR,
    externalCriticalAfterMinutes: 48 * HOUR,
    event: 'drepscore/sync.ghi',
  },
  benchmarks: {
    label: 'Benchmarks Sync',
    schedule: 'weekly',
    cadenceMinutes: WEEK,
    retriggerAfterMinutes: 8 * DAY,
    degradedAfterMinutes: 8 * DAY,
    criticalAfterMinutes: 16 * DAY,
    externalCriticalAfterMinutes: 8 * DAY,
    event: 'drepscore/sync.benchmarks',
  },
  spo_votes: {
    label: 'SPO Votes Sync',
    schedule: 'every 6h',
    cadenceMinutes: 6 * HOUR,
    retriggerAfterMinutes: 8 * HOUR,
    degradedAfterMinutes: 12 * HOUR,
    criticalAfterMinutes: 24 * HOUR,
    externalCriticalAfterMinutes: 12 * HOUR,
    event: 'drepscore/sync.spo-votes',
  },
  cc_votes: {
    label: 'CC Votes Sync',
    schedule: 'every 6h',
    cadenceMinutes: 6 * HOUR,
    retriggerAfterMinutes: 8 * HOUR,
    degradedAfterMinutes: 12 * HOUR,
    criticalAfterMinutes: 24 * HOUR,
    externalCriticalAfterMinutes: 12 * HOUR,
    event: 'drepscore/sync.cc-votes',
  },
  epoch_recaps: {
    label: 'Epoch Recaps',
    schedule: 'per epoch',
    cadenceMinutes: 6 * DAY,
    retriggerAfterMinutes: 6 * DAY,
    degradedAfterMinutes: 6 * DAY,
    criticalAfterMinutes: 12 * DAY,
    externalCriticalAfterMinutes: 6 * DAY,
    event: 'drepscore/sync.epoch-recaps',
  },
  spo_scores: {
    label: 'SPO Scores',
    schedule: 'daily',
    cadenceMinutes: DAY,
    retriggerAfterMinutes: 25 * HOUR,
    degradedAfterMinutes: 48 * HOUR,
    criticalAfterMinutes: 96 * HOUR,
    externalCriticalAfterMinutes: 48 * HOUR,
    event: 'drepscore/sync.spo-scores',
  },
  governance_epoch_stats: {
    label: 'Governance Epoch Stats',
    schedule: 'daily',
    cadenceMinutes: DAY,
    retriggerAfterMinutes: 25 * HOUR,
    degradedAfterMinutes: 48 * HOUR,
    criticalAfterMinutes: 96 * HOUR,
    externalCriticalAfterMinutes: 48 * HOUR,
    event: 'drepscore/sync.governance-epoch-stats',
  },
  data_moat: {
    label: 'Data Moat Sync',
    schedule: 'daily',
    cadenceMinutes: DAY,
    retriggerAfterMinutes: 25 * HOUR,
    degradedAfterMinutes: 48 * HOUR,
    criticalAfterMinutes: 96 * HOUR,
    externalCriticalAfterMinutes: 48 * HOUR,
    event: 'drepscore/sync.data-moat',
  },
  delegator_snapshots: {
    label: 'Delegator Snapshots',
    schedule: 'every 2d',
    cadenceMinutes: 2 * DAY,
    retriggerAfterMinutes: 48 * HOUR,
    degradedAfterMinutes: 48 * HOUR,
    criticalAfterMinutes: 96 * HOUR,
    externalCriticalAfterMinutes: 48 * HOUR,
    event: 'drepscore/sync.data-moat',
  },
  drep_lifecycle: {
    label: 'DRep Lifecycle',
    schedule: 'every 2d',
    cadenceMinutes: 2 * DAY,
    retriggerAfterMinutes: 48 * HOUR,
    degradedAfterMinutes: 48 * HOUR,
    criticalAfterMinutes: 96 * HOUR,
    externalCriticalAfterMinutes: 48 * HOUR,
    event: 'drepscore/sync.data-moat',
  },
  epoch_summaries: {
    label: 'Epoch Summaries',
    schedule: 'every 2d',
    cadenceMinutes: 2 * DAY,
    retriggerAfterMinutes: 48 * HOUR,
    degradedAfterMinutes: 48 * HOUR,
    criticalAfterMinutes: 96 * HOUR,
    externalCriticalAfterMinutes: 48 * HOUR,
    event: 'drepscore/sync.data-moat',
  },
  committee_sync: {
    label: 'Committee Sync',
    schedule: 'every 2d',
    cadenceMinutes: 2 * DAY,
    retriggerAfterMinutes: 48 * HOUR,
    degradedAfterMinutes: 48 * HOUR,
    criticalAfterMinutes: 96 * HOUR,
    externalCriticalAfterMinutes: 48 * HOUR,
    event: 'drepscore/sync.data-moat',
  },
  metadata_archive: {
    label: 'Metadata Archive',
    schedule: 'every 2d',
    cadenceMinutes: 2 * DAY,
    retriggerAfterMinutes: 48 * HOUR,
    degradedAfterMinutes: 48 * HOUR,
    criticalAfterMinutes: 96 * HOUR,
    externalCriticalAfterMinutes: 48 * HOUR,
    event: 'drepscore/sync.data-moat',
  },
  catalyst: {
    label: 'Catalyst Sync',
    schedule: 'daily',
    cadenceMinutes: DAY,
    retriggerAfterMinutes: 25 * HOUR,
    degradedAfterMinutes: 48 * HOUR,
    criticalAfterMinutes: 96 * HOUR,
    externalCriticalAfterMinutes: 48 * HOUR,
    event: 'drepscore/sync.catalyst',
  },
  catalyst_proposals: {
    label: 'Catalyst Proposals',
    schedule: 'every 2d',
    cadenceMinutes: 2 * DAY,
    retriggerAfterMinutes: 48 * HOUR,
    degradedAfterMinutes: 48 * HOUR,
    criticalAfterMinutes: 96 * HOUR,
    externalCriticalAfterMinutes: 48 * HOUR,
    event: 'drepscore/sync.catalyst',
  },
  catalyst_funds: {
    label: 'Catalyst Funds',
    schedule: 'every 2d',
    cadenceMinutes: 2 * DAY,
    retriggerAfterMinutes: 48 * HOUR,
    degradedAfterMinutes: 48 * HOUR,
    criticalAfterMinutes: 96 * HOUR,
    externalCriticalAfterMinutes: 48 * HOUR,
  },
};

const DEFAULT_SYNC_POLICY: SyncPolicy = {
  label: 'Unknown Sync',
  schedule: 'unknown',
  cadenceMinutes: 26 * HOUR,
  retriggerAfterMinutes: 26 * HOUR,
  degradedAfterMinutes: 26 * HOUR,
  criticalAfterMinutes: 52 * HOUR,
  externalCriticalAfterMinutes: 26 * HOUR,
};

export const CORE_SYNC_TYPES = Object.entries(SYNC_POLICY)
  .filter(([, policy]) => policy.core)
  .map(([syncType]) => syncType);

/**
 * Backwards-compatible export for the DRep layered freshness policy that the
 * read plane already consumes.
 */
export const SYNC_FRESHNESS_POLICY = {
  dreps: {
    cadenceMinutes: SYNC_POLICY.dreps.cadenceMinutes,
    retriggerAfterMinutes: SYNC_POLICY.dreps.retriggerAfterMinutes,
    degradedAfterMinutes: SYNC_POLICY.dreps.degradedAfterMinutes,
  },
} as const;

export function getSyncPolicy(syncType: string): SyncPolicy {
  return SYNC_POLICY[syncType as keyof typeof SYNC_POLICY] ?? DEFAULT_SYNC_POLICY;
}

export function mergeSyncHealthLevel(
  current: SyncHealthLevel,
  next: SyncHealthLevel,
): SyncHealthLevel {
  if (current === 'critical' || next === 'critical') return 'critical';
  if (current === 'degraded' || next === 'degraded') return 'degraded';
  return 'healthy';
}

export function getSyncHealthLevel(
  syncType: string,
  staleMinutes: number,
  lastSuccess: boolean | null | undefined,
): SyncHealthLevel {
  if (lastSuccess === false) return 'critical';

  const policy = getSyncPolicy(syncType);
  if (staleMinutes > policy.criticalAfterMinutes) return 'critical';
  if (staleMinutes > policy.degradedAfterMinutes) return 'degraded';
  return 'healthy';
}

export function getExternalSyncHealthLevel(
  syncType: string,
  staleMinutes: number,
  lastSuccess: boolean | null | undefined,
): 'healthy' | 'critical' {
  if (lastSuccess === false) return 'critical';
  return staleMinutes > getSyncPolicy(syncType).externalCriticalAfterMinutes
    ? 'critical'
    : 'healthy';
}
