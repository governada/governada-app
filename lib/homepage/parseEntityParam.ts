/**
 * Parse URL entity parameter into structured entity reference.
 *
 * Format: `drep_[id]`, `proposal_[txHash]_[index]`, `pool_[id]`, `cc_[id]`
 */

export type EntityType = 'drep' | 'proposal' | 'pool' | 'cc';

export interface EntityRef {
  type: EntityType;
  id: string;
  /** Proposal index (only for proposals) */
  secondaryId?: string;
}

export function parseEntityParam(entity: string | undefined | null): EntityRef | null {
  if (!entity) return null;

  const firstUnderscore = entity.indexOf('_');
  if (firstUnderscore === -1) return null;

  const prefix = entity.slice(0, firstUnderscore);
  const rest = entity.slice(firstUnderscore + 1);

  switch (prefix) {
    case 'drep':
      return rest ? { type: 'drep', id: rest } : null;
    case 'pool':
      return rest ? { type: 'pool', id: rest } : null;
    case 'cc':
      return rest ? { type: 'cc', id: rest } : null;
    case 'proposal': {
      // Format: proposal_[txHash]_[index]
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

/** Encode entity reference back to URL param format */
export function encodeEntityParam(type: EntityType, id: string, secondaryId?: string): string {
  if (type === 'proposal' && secondaryId) {
    return `proposal_${id}_${secondaryId}`;
  }
  return `${type}_${id}`;
}

/** Get the full page URL for an entity */
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
