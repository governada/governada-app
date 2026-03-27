/**
 * Fetch temporal governance data for a specific epoch.
 * Returns a timeline of events (votes, delegations) for globe time-lapse replay.
 */

export interface TemporalEvent {
  timestamp: number;
  type: 'vote' | 'delegation_snapshot' | 'epoch_start' | 'epoch_end';
  entityId: string;
  vote?: string;
  proposalRef?: string;
  delegatorCount?: number;
  votingPower?: number;
}

export interface TemporalEpochData {
  epoch: number;
  epochStart: number;
  epochEnd: number;
  eventCount: number;
  events: TemporalEvent[];
  recap: {
    proposals_submitted: number;
    proposals_ratified: number;
    proposals_expired: number;
    drep_participation_pct: number;
    ai_narrative: string | null;
  } | null;
}

export async function fetchTemporalData(epoch: number): Promise<TemporalEpochData | null> {
  const res = await fetch(`/api/governance/temporal?epoch=${epoch}`);
  if (!res.ok) return null;
  return res.json() as Promise<TemporalEpochData>;
}
