/**
 * Globe URL State — encode/decode globe camera & filter state to/from URL search params.
 *
 * URL Schema:
 *   ?focus=drep_<id>          Camera focused on entity
 *   &zoom=close|medium|far    Camera distance
 *   &filter=proposals|dreps|spos|cc  Node type filter
 *   &sector=treasury|innovation|security|transparency|decentralization|governance
 *   &view=votesplit|temporal|matches  Visualization mode
 *   &t=<epoch>                Temporal replay position
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GlobeZoom = 'close' | 'medium' | 'far';
export type GlobeFilter = 'proposals' | 'dreps' | 'spos' | 'cc';
export type GlobeSector =
  | 'treasury'
  | 'innovation'
  | 'security'
  | 'transparency'
  | 'decentralization'
  | 'governance';
export type GlobeView = 'votesplit' | 'temporal' | 'matches';

export interface GlobeUrlState {
  /** Entity focus: "drep_<id>", "proposal_<hash>_<index>", "pool_<id>", "cc_<id>" */
  focus: string | null;
  zoom: GlobeZoom;
  filter: GlobeFilter | null;
  sector: GlobeSector | null;
  view: GlobeView | null;
  /** Temporal replay epoch */
  temporalEpoch: number | null;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_GLOBE_STATE: GlobeUrlState = {
  focus: null,
  zoom: 'far',
  filter: null,
  sector: null,
  view: null,
  temporalEpoch: null,
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_ZOOMS = new Set<GlobeZoom>(['close', 'medium', 'far']);
const VALID_FILTERS = new Set<GlobeFilter>(['proposals', 'dreps', 'spos', 'cc']);
const VALID_SECTORS = new Set<GlobeSector>([
  'treasury',
  'innovation',
  'security',
  'transparency',
  'decentralization',
  'governance',
]);
const VALID_VIEWS = new Set<GlobeView>(['votesplit', 'temporal', 'matches']);

function isValidZoom(v: string): v is GlobeZoom {
  return VALID_ZOOMS.has(v as GlobeZoom);
}
function isValidFilter(v: string): v is GlobeFilter {
  return VALID_FILTERS.has(v as GlobeFilter);
}
function isValidSector(v: string): v is GlobeSector {
  return VALID_SECTORS.has(v as GlobeSector);
}
function isValidView(v: string): v is GlobeView {
  return VALID_VIEWS.has(v as GlobeView);
}

// ---------------------------------------------------------------------------
// Decode: URLSearchParams → GlobeUrlState
// ---------------------------------------------------------------------------

export function decodeGlobeState(params: URLSearchParams): GlobeUrlState {
  const focus = params.get('focus');
  const zoomRaw = params.get('zoom');
  const filterRaw = params.get('filter');
  const sectorRaw = params.get('sector');
  const viewRaw = params.get('view');
  const tRaw = params.get('t');

  return {
    focus: focus || null,
    zoom: zoomRaw && isValidZoom(zoomRaw) ? zoomRaw : 'far',
    filter: filterRaw && isValidFilter(filterRaw) ? filterRaw : null,
    sector: sectorRaw && isValidSector(sectorRaw) ? sectorRaw : null,
    view: viewRaw && isValidView(viewRaw) ? viewRaw : null,
    temporalEpoch: tRaw ? parseInt(tRaw, 10) || null : null,
  };
}

// ---------------------------------------------------------------------------
// Encode: GlobeUrlState → URLSearchParams string (only non-default values)
// ---------------------------------------------------------------------------

export function encodeGlobeState(state: GlobeUrlState): string {
  const parts: string[] = [];

  if (state.focus) parts.push(`focus=${encodeURIComponent(state.focus)}`);
  if (state.zoom !== 'far') parts.push(`zoom=${state.zoom}`);
  if (state.filter) parts.push(`filter=${state.filter}`);
  if (state.sector) parts.push(`sector=${state.sector}`);
  if (state.view) parts.push(`view=${state.view}`);
  if (state.temporalEpoch != null) parts.push(`t=${state.temporalEpoch}`);

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

// ---------------------------------------------------------------------------
// Entity focus helpers — build focus strings from route params
// ---------------------------------------------------------------------------

export function buildDRepFocus(drepId: string): string {
  return `drep_${drepId}`;
}

export function buildProposalFocus(txHash: string, index: number): string {
  return `proposal_${txHash}_${index}`;
}

export function buildPoolFocus(poolId: string): string {
  return `pool_${poolId}`;
}

export function buildCCFocus(ccHotId: string): string {
  return `cc_${ccHotId}`;
}

/** Parse a focus string back to entity type + id */
export function parseFocus(focus: string): {
  type: 'drep' | 'proposal' | 'pool' | 'cc';
  id: string;
  /** For proposals: the index */
  index?: number;
} | null {
  if (focus.startsWith('drep_')) {
    return { type: 'drep', id: focus.slice(5) };
  }
  if (focus.startsWith('proposal_')) {
    const rest = focus.slice(9);
    const lastUnderscore = rest.lastIndexOf('_');
    if (lastUnderscore === -1) return null;
    const txHash = rest.slice(0, lastUnderscore);
    const index = parseInt(rest.slice(lastUnderscore + 1), 10);
    if (isNaN(index)) return null;
    return { type: 'proposal', id: txHash, index };
  }
  if (focus.startsWith('pool_')) {
    return { type: 'pool', id: focus.slice(5) };
  }
  if (focus.startsWith('cc_')) {
    return { type: 'cc', id: focus.slice(3) };
  }
  return null;
}
