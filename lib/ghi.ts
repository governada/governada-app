/**
 * Governance Health Index (GHI) — backward-compatible re-export.
 *
 * All logic now lives in lib/ghi/. This file re-exports the public API
 * so existing consumers (components, API routes, cron) need zero changes.
 */

export {
  type GHIBand,
  type GHIComponent,
  type GHIResult,
  GHI_BAND_COLORS,
  GHI_BAND_LABELS,
  getBand,
} from './ghi/types';

export { computeGHI, type GHIComputeResult } from './ghi/index';
