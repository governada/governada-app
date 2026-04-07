import { describe, expect, it } from 'vitest';
import {
  getExternalSyncHealthLevel,
  getSyncHealthLevel,
  getSyncPolicy,
  mergeSyncHealthLevel,
} from '@/lib/syncPolicy';

describe('syncPolicy', () => {
  it('keeps layered thresholds for DRep freshness', () => {
    const policy = getSyncPolicy('dreps');

    expect(policy.retriggerAfterMinutes).toBe(8 * 60);
    expect(policy.degradedAfterMinutes).toBe(12 * 60);
    expect(policy.criticalAfterMinutes).toBe(24 * 60);
  });

  it('returns degraded before critical for main health status', () => {
    expect(getSyncHealthLevel('proposals', 100, true)).toBe('degraded');
    expect(getSyncHealthLevel('proposals', 181, true)).toBe('critical');
  });

  it('uses the external health threshold for core liveness checks', () => {
    expect(getExternalSyncHealthLevel('proposals', 100, true)).toBe('healthy');
    expect(getExternalSyncHealthLevel('proposals', 121, true)).toBe('critical');
  });

  it('treats failed syncs as critical regardless of staleness', () => {
    expect(getSyncHealthLevel('alignment', 5, false)).toBe('critical');
    expect(getExternalSyncHealthLevel('alignment', 5, false)).toBe('critical');
  });

  it('merges health levels by worst severity', () => {
    expect(mergeSyncHealthLevel('healthy', 'degraded')).toBe('degraded');
    expect(mergeSyncHealthLevel('degraded', 'critical')).toBe('critical');
  });
});
