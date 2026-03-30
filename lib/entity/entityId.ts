/**
 * Unified entity ID parsing and formatting.
 *
 * Entity IDs appear in multiple formats across the codebase:
 * - Constellation node IDs: `drep_[hash]`, `proposal_[txHash]_[index]`, `spo_[poolId]`, `cc_[hotId]`
 * - URL route paths: `/drep/[hash]`, `/proposal/[txHash]/[index]`, `/pool/[poolId]`, `/committee/[hotId]`
 * - API/DB: raw hash strings
 * - Vote split refs: `[txHash]_[index]`
 *
 * This module is the single source of truth for all conversions.
 */

export type EntityType = 'drep' | 'proposal' | 'pool' | 'cc';

export interface EntityRef {
  type: EntityType;
  id: string;
  /** Proposal index (only for proposals) */
  secondaryId?: string;
}

// ---------------------------------------------------------------------------
// Parse from constellation node ID format (drep_xxx, proposal_tx_idx, spo_xxx, cc_xxx)
// ---------------------------------------------------------------------------

export function parseNodeId(nodeId: string | undefined | null): EntityRef | null {
  if (!nodeId) return null;

  const firstUnderscore = nodeId.indexOf('_');
  if (firstUnderscore === -1) return null;

  const prefix = nodeId.slice(0, firstUnderscore);
  const rest = nodeId.slice(firstUnderscore + 1);
  if (!rest) return null;

  switch (prefix) {
    case 'drep':
      return { type: 'drep', id: rest };
    case 'spo':
    case 'pool':
      return { type: 'pool', id: rest };
    case 'cc':
      return { type: 'cc', id: rest };
    case 'proposal': {
      const lastUnderscore = rest.lastIndexOf('_');
      if (lastUnderscore === -1) return null;
      const txHash = rest.slice(0, lastUnderscore);
      const index = rest.slice(lastUnderscore + 1);
      return txHash && index ? { type: 'proposal', id: txHash, secondaryId: index } : null;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Parse from URL entity parameter (same format as node IDs — kept for compat)
// ---------------------------------------------------------------------------

/** @deprecated Use parseNodeId instead — same format */
export const parseEntityParam = parseNodeId;

// ---------------------------------------------------------------------------
// Parse from vote split proposal ref format (txHash_index)
// ---------------------------------------------------------------------------

export function parseProposalRef(ref: string): { txHash: string; index: number } | null {
  const lastUnderscore = ref.lastIndexOf('_');
  if (lastUnderscore === -1) return null;
  const txHash = ref.slice(0, lastUnderscore);
  const index = parseInt(ref.slice(lastUnderscore + 1), 10);
  if (!txHash || isNaN(index)) return null;
  return { txHash, index };
}

// ---------------------------------------------------------------------------
// Convert to node ID format
// ---------------------------------------------------------------------------

export function toNodeId(ref: EntityRef): string {
  const prefix = ref.type === 'pool' ? 'spo' : ref.type;
  if (ref.type === 'proposal' && ref.secondaryId) {
    return `proposal_${ref.id}_${ref.secondaryId}`;
  }
  return `${prefix}_${ref.id}`;
}

// ---------------------------------------------------------------------------
// Encode back to URL param format (identical to node ID for most types)
// ---------------------------------------------------------------------------

export function encodeEntityParam(type: EntityType, id: string, secondaryId?: string): string {
  if (type === 'proposal' && secondaryId) {
    return `proposal_${id}_${secondaryId}`;
  }
  return `${type}_${id}`;
}

// ---------------------------------------------------------------------------
// Convert to full page URL
// ---------------------------------------------------------------------------

export function getEntityPageUrl(ref: EntityRef): string {
  switch (ref.type) {
    case 'drep':
      return `/drep/${encodeURIComponent(ref.id)}`;
    case 'proposal':
      return `/proposal/${ref.id}/${ref.secondaryId ?? '0'}`;
    case 'pool':
      return `/pool/${encodeURIComponent(ref.id)}`;
    case 'cc':
      return `/committee/${encodeURIComponent(ref.id)}`;
  }
}

// ---------------------------------------------------------------------------
// Parse from URL route path (/drep/[hash], /proposal/[tx]/[idx], etc.)
// ---------------------------------------------------------------------------

export function parseRoutePath(path: string): EntityRef | null {
  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'drep' && segments[1]) {
    return { type: 'drep', id: decodeURIComponent(segments[1]) };
  }
  if (segments[0] === 'proposal' && segments[1] && segments[2]) {
    return { type: 'proposal', id: segments[1], secondaryId: segments[2] };
  }
  if (segments[0] === 'pool' && segments[1]) {
    return { type: 'pool', id: decodeURIComponent(segments[1]) };
  }
  if (segments[0] === 'committee' && segments[1]) {
    return { type: 'cc', id: decodeURIComponent(segments[1]) };
  }

  return null;
}
