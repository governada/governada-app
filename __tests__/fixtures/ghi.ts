/**
 * Shared test fixtures for GHI / EDI test suites.
 * Known power distributions with analytically computable results.
 */

/**
 * Perfect equality: 10 entities each with 100 units.
 * Expected: Gini ≈ 0, Shannon ≈ 1.0, Nakamoto = 6 (>50%), HHI = 1000
 */
export const EQUAL_DISTRIBUTION = Array(10).fill(100);

/**
 * Perfect inequality: 1 entity has everything, 9 have nothing.
 * Expected: Gini → 1, Shannon = 0, Nakamoto = 1, HHI = 10000
 */
export const MONOPOLY_DISTRIBUTION = [1000, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/**
 * Single entity (degenerate case).
 */
export const SINGLE_ENTITY = [1000];

/**
 * Two equal entities.
 * Nakamoto(50%) = 2 (both needed to exceed 50%)
 * Gini = 0, Shannon = 1.0
 */
export const TWO_EQUAL = [500, 500];

/**
 * Realistic Cardano-like distribution: top-heavy with long tail.
 * Top 3 hold ~60%, next 7 hold ~30%, last 10 hold ~10%.
 */
export const REALISTIC_DISTRIBUTION = [
  2000,
  1500,
  1200, // top 3 = 4700
  500,
  400,
  400,
  350,
  300,
  250,
  200, // mid 7 = 2400
  100,
  80,
  70,
  60,
  50,
  40,
  30,
  20,
  10,
  5, // tail 10 = 465
];

/**
 * Moderate concentration: 5 entities with decreasing shares.
 * Total = 150. Top entity = 50 (33%).
 */
export const MODERATE_CONCENTRATION = [50, 40, 30, 20, 10];

/**
 * Empty distribution.
 */
export const EMPTY_DISTRIBUTION: number[] = [];
