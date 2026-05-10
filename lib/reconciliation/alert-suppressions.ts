/**
 * Reconciliation alert suppressions.
 *
 * Allowlist of mismatch metrics that are known persistent conditions and
 * should NOT page on every check. The reconciliation_log audit trail still
 * records every mismatch in full; only Discord alerting is suppressed.
 *
 * Each entry must cite a reason and a link/note for the investigation that
 * should retire the suppression. Suppressions are not a permanent state —
 * they're a deliberate noise downgrade while a real fix lands.
 *
 * Phase 2's persistent_mismatch self-heal class will eventually make this
 * dynamic (auto-quarantine after N consecutive same-metric mismatches).
 * Until then, this static list is the immediate noise mitigation.
 */
import type { CheckResult } from './types';

export interface AlertSuppression {
  /** Exact metric name from CheckResult.metric */
  metric: string;
  /** Why this is suppressed (cite evidence + investigation pointer) */
  reason: string;
  /** ISO date when suppression started */
  suppressedSince: string;
  /** Optional ISO date when suppression auto-expires (defense against stale entries) */
  expiresAt?: string;
}

export const ALERT_SUPPRESSIONS: AlertSuppression[] = [
  {
    metric: 'Total registered DReps',
    reason:
      'Persistent ~27% delta between Koios (ours) and Blockfrost (theirs) — diff ~435 absolute. ' +
      'lib/reconciliation/types.ts:138-140 documents that this gap is expected because Koios only ' +
      'returns active DReps while Blockfrost includes retired; the percentRelative tolerance was ' +
      'set to 35% accordingly. countAbsolute (50) is the strict gate that keeps tripping on every ' +
      "run. Surfaced loudly when sample-tier1's 5-min cadence shipped 2026-05-10. Investigation " +
      'pending: either tune countAbsolute to ~500 (matches the documented intent), or fix the ' +
      'underlying counting semantic so the two sources agree. Suppress until either resolves.',
    suppressedSince: '2026-05-10',
    expiresAt: '2026-08-10',
  },
];

export interface SuppressionResult<T extends Pick<CheckResult, 'metric'>> {
  /** Mismatches that should still surface to alerting */
  surfaced: T[];
  /** Mismatches that matched a suppression entry */
  suppressed: T[];
}

const SUPPRESSED_METRICS_LOOKUP = new Map<string, AlertSuppression>(
  ALERT_SUPPRESSIONS.map((entry) => [entry.metric, entry]),
);

export function isSuppressed(metric: string, now: Date = new Date()): boolean {
  const entry = SUPPRESSED_METRICS_LOOKUP.get(metric);
  if (!entry) return false;
  if (entry.expiresAt && new Date(entry.expiresAt) < now) return false;
  return true;
}

export function partitionMismatches<T extends Pick<CheckResult, 'metric'>>(
  mismatches: T[],
  now: Date = new Date(),
): SuppressionResult<T> {
  const surfaced: T[] = [];
  const suppressed: T[] = [];
  for (const mismatch of mismatches) {
    if (isSuppressed(mismatch.metric, now)) suppressed.push(mismatch);
    else surfaced.push(mismatch);
  }
  return { surfaced, suppressed };
}

/**
 * Effective overall status after suppression: if all mismatches are
 * suppressed, treat as 'match' for alerting purposes (the reconciliation_log
 * still records the true status). If any unsuppressed remain, return the
 * worst of those.
 */
export function effectiveStatusAfterSuppression(
  surfaced: Array<Pick<CheckResult, 'status'>>,
): 'match' | 'drift' | 'mismatch' {
  if (surfaced.length === 0) return 'match';
  if (surfaced.some((m) => m.status === 'mismatch')) return 'mismatch';
  return 'drift';
}
