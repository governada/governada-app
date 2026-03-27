/**
 * Panel utility helpers — derive entity info from /g/ route paths.
 */

export interface PanelEntity {
  type: 'drep' | 'proposal' | 'pool' | 'cc';
  id: string;
  secondaryId?: string;
}

/** Extract entity type + id from a /g/ route path. Returns null for /g (no entity). */
export function deriveEntityFromPath(pathname: string): PanelEntity | null {
  // /g/drep/[drepId]
  const drepMatch = pathname.match(/^\/g\/drep\/([^/]+)/);
  if (drepMatch) {
    return { type: 'drep', id: decodeURIComponent(drepMatch[1]) };
  }

  // /g/proposal/[txHash]/[index]
  const proposalMatch = pathname.match(/^\/g\/proposal\/([a-f0-9]+)\/(\d+)/);
  if (proposalMatch) {
    return { type: 'proposal', id: proposalMatch[1], secondaryId: proposalMatch[2] };
  }

  // /g/pool/[poolId]
  const poolMatch = pathname.match(/^\/g\/pool\/([^/]+)/);
  if (poolMatch) {
    return { type: 'pool', id: decodeURIComponent(poolMatch[1]) };
  }

  // /g/cc/[ccHotId]
  const ccMatch = pathname.match(/^\/g\/cc\/([^/]+)/);
  if (ccMatch) {
    return { type: 'cc', id: decodeURIComponent(ccMatch[1]) };
  }

  return null;
}
