/**
 * GHI calibration — re-exports the shared calibration function and GHI-specific curves
 * from the centralized scoring configuration.
 */

// Re-export the calibrate function and curve type from centralized config
export { calibrate, type CalibrationCurve } from '@/lib/scoring/calibration';

import { GHI_CALIBRATION } from '@/lib/scoring/calibration';

// Re-export GHI calibration curves
export const CALIBRATION = GHI_CALIBRATION;
