/**
 * Shared freshness policy for domains where the read plane needs a different
 * retrigger threshold than the operator-facing degraded threshold.
 */
export const SYNC_FRESHNESS_POLICY = {
  dreps: {
    cadenceMinutes: 6 * 60,
    retriggerAfterMinutes: 8 * 60,
    degradedAfterMinutes: 12 * 60,
  },
} as const;
