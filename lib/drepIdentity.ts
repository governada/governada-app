/**
 * DRep Identity System — dominant alignment dimension + identity color palette.
 * Shared foundation used by Session 12 constellation and Session 13 visual identity.
 */

export type AlignmentDimension =
  | 'treasuryConservative'
  | 'treasuryGrowth'
  | 'decentralization'
  | 'security'
  | 'innovation'
  | 'transparency';

export interface IdentityColor {
  hex: string;
  rgb: [number, number, number];
  label: string;
}

const IDENTITY_COLORS: Record<AlignmentDimension, IdentityColor> = {
  treasuryConservative: { hex: '#dc2626', rgb: [220, 38, 38], label: 'Deep Red' },
  treasuryGrowth: { hex: '#10b981', rgb: [16, 185, 129], label: 'Emerald' },
  decentralization: { hex: '#a855f7', rgb: [168, 85, 247], label: 'Purple' },
  security: { hex: '#f59e0b', rgb: [245, 158, 11], label: 'Amber' },
  innovation: { hex: '#06b6d4', rgb: [6, 182, 212], label: 'Cyan' },
  transparency: { hex: '#3b82f6', rgb: [59, 130, 246], label: 'Blue' },
};

const DIMENSION_LABELS: Record<AlignmentDimension, string> = {
  treasuryConservative: 'Treasury Conservative',
  treasuryGrowth: 'Treasury Growth',
  decentralization: 'Decentralization',
  security: 'Security',
  innovation: 'Innovation',
  transparency: 'Transparency',
};

const DIMENSION_ORDER: AlignmentDimension[] = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
];

export interface AlignmentScores {
  treasuryConservative: number | null;
  treasuryGrowth: number | null;
  decentralization: number | null;
  security: number | null;
  innovation: number | null;
  transparency: number | null;
}

/**
 * Extract the 6 alignment scores from a DRep row (DB column names → typed object).
 */
export function extractAlignments(row: {
  alignment_treasury_conservative?: number | null;
  alignment_treasury_growth?: number | null;
  alignment_decentralization?: number | null;
  alignment_security?: number | null;
  alignment_innovation?: number | null;
  alignment_transparency?: number | null;
  alignmentTreasuryConservative?: number | null;
  alignmentTreasuryGrowth?: number | null;
  alignmentDecentralization?: number | null;
  alignmentSecurity?: number | null;
  alignmentInnovation?: number | null;
  alignmentTransparency?: number | null;
}): AlignmentScores {
  return {
    treasuryConservative:
      row.alignment_treasury_conservative ?? row.alignmentTreasuryConservative ?? null,
    treasuryGrowth: row.alignment_treasury_growth ?? row.alignmentTreasuryGrowth ?? null,
    decentralization: row.alignment_decentralization ?? row.alignmentDecentralization ?? null,
    security: row.alignment_security ?? row.alignmentSecurity ?? null,
    innovation: row.alignment_innovation ?? row.alignmentInnovation ?? null,
    transparency: row.alignment_transparency ?? row.alignmentTransparency ?? null,
  };
}

/**
 * Get the 6 alignment scores as an ordered array [0-100 each].
 * Null scores default to 50.
 */
export function alignmentsToArray(scores: AlignmentScores): number[] {
  return DIMENSION_ORDER.map((dim) => scores[dim] ?? 50);
}

/**
 * Determine a DRep's dominant alignment dimension — the one furthest from 50.
 * Ties broken by order in DIMENSION_ORDER.
 */
export function getDominantDimension(scores: AlignmentScores): AlignmentDimension {
  let best: AlignmentDimension = 'transparency';
  let bestDistance = -1;

  for (const dim of DIMENSION_ORDER) {
    const val = scores[dim] ?? 50;
    const distance = Math.abs(val - 50);
    if (distance > bestDistance) {
      bestDistance = distance;
      best = dim;
    }
  }

  return best;
}

export function getIdentityColor(dimension: AlignmentDimension): IdentityColor {
  return IDENTITY_COLORS[dimension];
}

export function getDimensionLabel(dimension: AlignmentDimension): string {
  return DIMENSION_LABELS[dimension];
}

export function getDimensionOrder(): AlignmentDimension[] {
  return [...DIMENSION_ORDER];
}

export function getAllIdentityColors(): Record<AlignmentDimension, IdentityColor> {
  return { ...IDENTITY_COLORS };
}

/* ──────────────────────────────────────────────
   Session 13 extensions — gradients, glow, hex,
   personality labels for the visual identity system
   ────────────────────────────────────────────── */

/**
 * CSS gradient string for profile heroes and card accents.
 * Fades from the identity color at low opacity into the dark base.
 */
export function getIdentityGradient(dimension: AlignmentDimension): string {
  const color = IDENTITY_COLORS[dimension];
  return `linear-gradient(135deg, rgba(${color.rgb.join(',')}, 0.08) 0%, rgba(10, 11, 20, 0) 60%)`;
}

/**
 * Box-shadow string for hover glow effects in the identity color.
 */
export function getIdentityGlow(dimension: AlignmentDimension): string {
  const color = IDENTITY_COLORS[dimension];
  return `0 0 0 1px rgba(${color.rgb.join(',')}, 0.12), 0 0 24px rgba(${color.rgb.join(',')}, 0.06)`;
}

/**
 * CSS custom property values for the AccentProvider to set on a wrapping element.
 */
export function getIdentityCSSVars(dimension: AlignmentDimension): Record<string, string> {
  const color = IDENTITY_COLORS[dimension];
  return {
    '--identity': color.hex,
    '--identity-rgb': color.rgb.join(' '),
  };
}

/**
 * Compute the 6 hex vertices for an asymmetric hexagonal score shape.
 * Each vertex radius is proportional to the alignment score (0-100).
 * Returns an array of [x, y] pairs.
 */
export function getHexVertices(
  alignments: AlignmentScores,
  size: number,
  minRadius = 0.25,
): [number, number][] {
  const center = size / 2;
  const maxRadius = size / 2 - 2;
  const scores = alignmentsToArray(alignments);

  return scores.map((score, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const normalizedScore = score / 100;
    const radius = maxRadius * (minRadius + normalizedScore * (1 - minRadius));
    return [center + radius * Math.cos(angle), center + radius * Math.sin(angle)];
  });
}

/**
 * Convert hex vertices to an SVG polygon points string.
 */
export function hexVerticesToPath(vertices: [number, number][]): string {
  return vertices.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

/**
 * Radar polygon points for the GovernanceRadar — same math as hex
 * but with configurable number of axes (always 6 for alignment).
 */
export function getRadarPoints(
  alignments: AlignmentScores,
  size: number,
  padding = 24,
): [number, number][] {
  const center = size / 2;
  const maxRadius = (size - padding * 2) / 2;
  const scores = alignmentsToArray(alignments);

  return scores.map((score, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const radius = maxRadius * (score / 100);
    return [center + radius * Math.cos(angle), center + radius * Math.sin(angle)];
  });
}

/**
 * Get the axis endpoint positions for the radar grid (at 100%).
 */
export function getRadarAxisEndpoints(size: number, padding = 24): [number, number][] {
  const center = size / 2;
  const radius = (size - padding * 2) / 2;

  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return [center + radius * Math.cos(angle), center + radius * Math.sin(angle)] as [
      number,
      number,
    ];
  });
}

/** Short, evocative archetypes derived from alignment scores. */
const PERSONALITY_ARCHETYPES: Record<AlignmentDimension, string[]> = {
  treasuryConservative: ['The Guardian', 'The Fiscal Hawk', 'The Prudent Steward'],
  treasuryGrowth: ['The Builder', 'The Growth Champion', 'The Catalyst'],
  decentralization: ['The Federalist', 'The Power Distributor', 'The Decentralizer'],
  security: ['The Sentinel', 'The Cautious Architect', 'The Shield'],
  innovation: ['The Pioneer', 'The Changemaker', 'The Innovator'],
  transparency: ['The Beacon', 'The Transparent Champion', 'The Open Book'],
};

/**
 * Derive a single personality archetype from alignment scores.
 * Uses the dominant dimension and score magnitude to select a label.
 */
export function getPersonalityLabel(alignments: AlignmentScores): string {
  const dominant = getDominantDimension(alignments);
  const score = alignments[dominant] ?? 50;
  const distance = Math.abs(score - 50);
  const labels = PERSONALITY_ARCHETYPES[dominant];

  if (distance > 30) return labels[0];
  if (distance > 15) return labels[1];
  return labels[2];
}
