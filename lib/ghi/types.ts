/**
 * GHI shared types and constants — extracted for use by both the orchestrator
 * and backward-compatible re-exports from lib/ghi.ts.
 */

export type GHIBand = 'critical' | 'fair' | 'good' | 'strong';

export interface GHIComponent {
  name: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface GHIResult {
  score: number;
  band: GHIBand;
  components: GHIComponent[];
}

export function getBand(score: number): GHIBand {
  if (score >= 76) return 'strong';
  if (score >= 51) return 'good';
  if (score >= 26) return 'fair';
  return 'critical';
}

export const GHI_BAND_COLORS: Record<GHIBand, string> = {
  critical: '#ef4444',
  fair: '#f59e0b',
  good: '#06b6d4',
  strong: '#10b981',
};

export const GHI_BAND_LABELS: Record<GHIBand, string> = {
  critical: 'Critical',
  fair: 'Fair',
  good: 'Good',
  strong: 'Strong',
};
