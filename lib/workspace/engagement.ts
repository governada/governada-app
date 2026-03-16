/**
 * Client-side engagement tracking helpers.
 *
 * Sends lightweight events to /api/workspace/engagement/track for analytics.
 * All functions are fire-and-forget — failures are silently ignored.
 */

async function getHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  return headers;
}

async function trackEvent(payload: Record<string, unknown>): Promise<void> {
  try {
    const headers = await getHeaders();
    await fetch('/api/workspace/engagement/track', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    // Fire-and-forget
  }
}

export function trackProposalView(
  txHash: string,
  index: number,
  userId?: string,
  segment?: string,
): void {
  void trackEvent({
    proposalTxHash: txHash,
    proposalIndex: index,
    eventType: 'view',
    userSegment: segment,
  });
}

export function trackSectionRead(
  txHash: string,
  index: number,
  section: string,
  durationSeconds: number,
  segment?: string,
): void {
  void trackEvent({
    proposalTxHash: txHash,
    proposalIndex: index,
    eventType: 'section_read',
    section,
    durationSeconds: Math.min(Math.round(durationSeconds), 3600),
    userSegment: segment,
  });
}

export function trackAnnotationCreated(txHash: string, index: number, segment?: string): void {
  void trackEvent({
    proposalTxHash: txHash,
    proposalIndex: index,
    eventType: 'annotation_created',
    userSegment: segment,
  });
}
