/**
 * Cluster Detection — K-means clustering on 6D governance alignment vectors.
 *
 * Identifies governance "factions" by clustering DReps based on their alignment
 * scores across 6 dimensions. Uses K-means++ initialization for stability.
 *
 * Pure function — no side effects, no external state. Imports only from
 * lib/constellation/globe-layout.ts (for sphere position mapping) and
 * lib/drepIdentity.ts (for dimension types).
 */

import {
  computeSpherePosition,
  sphereToCartesian,
  GLOBE_RADIUS,
} from '@/lib/constellation/globe-layout';
import type { LayoutInput } from '@/lib/constellation/globe-layout';
import type { AlignmentDimension } from '@/lib/drepIdentity';
import { DIMENSION_ORDER } from '@/lib/drepIdentity';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Cluster {
  /** Stable identifier, e.g. "cluster-0" */
  id: string;
  /** 6D centroid in alignment space (0-100 per dimension) */
  centroid6D: number[];
  /** [lon, lat] on the sphere via computeSpherePosition() */
  centroidSphere: [number, number];
  /** Cartesian [x, y, z] via sphereToCartesian() */
  centroid3D: [number, number, number];
  /** IDs of member nodes */
  memberIds: string[];
  /** The alignment dimension most represented in this cluster */
  dominantDimension: AlignmentDimension;
  /** Number of members */
  memberCount: number;
}

export interface ClusterResult {
  clusters: Cluster[];
  silhouetteScore: number;
  k: number;
}

// ---------------------------------------------------------------------------
// K-means++ initialization
// ---------------------------------------------------------------------------

/** Pick initial centroids using K-means++ (weighted probability by distance squared) */
function kmeansppInit(points: number[][], k: number): number[][] {
  const n = points.length;
  if (n === 0 || k <= 0) return [];

  const centroids: number[][] = [];

  // Pick first centroid uniformly at random (deterministic: pick the median-power node)
  const firstIdx = Math.floor(n / 2);
  centroids.push([...points[firstIdx]]);

  for (let c = 1; c < k; c++) {
    // Pick the point farthest from any existing centroid (deterministic K-means++)
    let maxIdx = 0;
    let maxD = 0;
    for (let i = 0; i < n; i++) {
      let minD = Infinity;
      for (const centroid of centroids) {
        const d = euclideanDistSq(points[i], centroid);
        if (d < minD) minD = d;
      }
      if (minD > maxD) {
        maxD = minD;
        maxIdx = i;
      }
    }
    centroids.push([...points[maxIdx]]);
  }

  return centroids;
}

// ---------------------------------------------------------------------------
// K-means core
// ---------------------------------------------------------------------------

interface KMeansResult {
  centroids: number[][];
  assignments: number[];
  iterations: number;
}

function kmeans(points: number[][], k: number, maxIter: number = 100): KMeansResult {
  const n = points.length;
  const dims = points[0]?.length ?? 0;
  if (n === 0 || dims === 0) return { centroids: [], assignments: [], iterations: 0 };

  let centroids = kmeansppInit(points, k);
  let assignments = new Array<number>(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assignment step: assign each point to nearest centroid
    const newAssignments = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      let bestC = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = euclideanDistSq(points[i], centroids[c]);
        if (d < bestD) {
          bestD = d;
          bestC = c;
        }
      }
      newAssignments[i] = bestC;
    }

    // Check convergence
    let changed = false;
    for (let i = 0; i < n; i++) {
      if (newAssignments[i] !== assignments[i]) {
        changed = true;
        break;
      }
    }
    assignments = newAssignments;
    if (!changed) return { centroids, assignments, iterations: iter + 1 };

    // Update step: recalculate centroids
    const sums = Array.from({ length: k }, () => new Float64Array(dims));
    const counts = new Array<number>(k).fill(0);

    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      counts[c]++;
      for (let d = 0; d < dims; d++) {
        sums[c][d] += points[i][d];
      }
    }

    centroids = sums.map((s, c) => {
      if (counts[c] === 0) return centroids[c]; // Keep empty cluster centroid
      return Array.from(s).map((v) => v / counts[c]);
    });
  }

  return { centroids, assignments, iterations: maxIter };
}

// ---------------------------------------------------------------------------
// Silhouette score
// ---------------------------------------------------------------------------

/**
 * Compute mean silhouette score for a clustering.
 * Range: -1 (bad) to +1 (good). >0.25 indicates meaningful separation.
 */
export function computeSilhouetteScore(
  points: number[][],
  assignments: number[],
  k: number,
): number {
  const n = points.length;
  if (n <= k || k <= 1) return 0;

  // Group points by cluster
  const clusterMembers: number[][] = Array.from({ length: k }, () => []);
  for (let i = 0; i < n; i++) {
    clusterMembers[assignments[i]].push(i);
  }

  let totalSilhouette = 0;
  let counted = 0;

  for (let i = 0; i < n; i++) {
    const myCluster = assignments[i];
    const myMembers = clusterMembers[myCluster];

    // a(i) = average distance to same-cluster points
    if (myMembers.length <= 1) continue; // singleton cluster — skip

    let aSum = 0;
    for (const j of myMembers) {
      if (j !== i) aSum += euclideanDist(points[i], points[j]);
    }
    const a = aSum / (myMembers.length - 1);

    // b(i) = minimum average distance to any other cluster's points
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === myCluster || clusterMembers[c].length === 0) continue;
      let bSum = 0;
      for (const j of clusterMembers[c]) {
        bSum += euclideanDist(points[i], points[j]);
      }
      const avgDist = bSum / clusterMembers[c].length;
      if (avgDist < b) b = avgDist;
    }

    if (b === Infinity) continue;

    const s = (b - a) / Math.max(a, b);
    totalSilhouette += s;
    counted++;
  }

  return counted > 0 ? totalSilhouette / counted : 0;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Detect governance factions from alignment data.
 *
 * Runs K-means for k=5..8 and picks the k with the best silhouette score.
 * Returns clusters with centroid positions mapped to the globe sphere.
 *
 * @param inputs - LayoutInput[] from the constellation API (DReps only recommended)
 * @param options - Optional overrides for min/max k
 */
export function detectClusters(
  inputs: LayoutInput[],
  options?: { minK?: number; maxK?: number },
): ClusterResult {
  const minK = options?.minK ?? 5;
  const maxK = options?.maxK ?? 8;

  // Filter to nodes that have meaningful alignment data
  const validInputs = inputs.filter(
    (inp) => inp.alignments.length >= 6 && inp.alignments.some((a) => a !== 50),
  );

  if (validInputs.length < minK) {
    return { clusters: [], silhouetteScore: 0, k: 0 };
  }

  // Extract 6D alignment vectors
  const points = validInputs.map((inp) => inp.alignments.slice(0, 6));

  // Try each k and pick best silhouette
  let bestResult: KMeansResult | null = null;
  let bestK = minK;
  let bestSilhouette = -Infinity;

  for (let k = minK; k <= maxK; k++) {
    if (k > validInputs.length) break;

    const result = kmeans(points, k);
    const score = computeSilhouetteScore(points, result.assignments, k);

    // Also check that no cluster is too small (< 3 members)
    const counts = new Array<number>(k).fill(0);
    for (const a of result.assignments) counts[a]++;
    const hasSmallCluster = counts.some((c) => c > 0 && c < 3);

    // Penalize solutions with tiny clusters
    const adjustedScore = hasSmallCluster ? score - 0.1 : score;

    if (adjustedScore > bestSilhouette) {
      bestSilhouette = adjustedScore;
      bestResult = result;
      bestK = k;
    }
  }

  if (!bestResult) {
    return { clusters: [], silhouetteScore: 0, k: 0 };
  }

  // Recompute actual silhouette (without penalty)
  const actualSilhouette = computeSilhouetteScore(points, bestResult.assignments, bestK);

  // Build cluster objects
  const clusters: Cluster[] = [];
  for (let c = 0; c < bestK; c++) {
    const memberIndices = bestResult.assignments
      .map((a, i) => (a === c ? i : -1))
      .filter((i) => i >= 0);

    if (memberIndices.length === 0) continue;

    const centroid6D = bestResult.centroids[c];
    const memberIds = memberIndices.map((i) => validInputs[i].id);

    // Find dominant dimension (furthest from 50)
    const dominantDimension = findDominantDimension(centroid6D);

    // Map centroid to sphere position using the same function the globe uses
    const syntheticInput: LayoutInput = {
      id: `cluster-${c}-centroid`,
      fullId: `cluster-${c}-centroid`,
      name: null,
      power: 0.5,
      score: 50,
      dominant: dominantDimension,
      alignments: centroid6D,
      nodeType: 'drep',
    };

    const [lon, lat] = computeSpherePosition(syntheticInput);
    // Place cluster label at mid-depth in the DRep shell
    const labelRadius = GLOBE_RADIUS * 0.7;
    const centroid3D = sphereToCartesian(lat, lon, labelRadius);

    clusters.push({
      id: `cluster-${c}`,
      centroid6D,
      centroidSphere: [lon, lat],
      centroid3D,
      memberIds,
      dominantDimension,
      memberCount: memberIds.length,
    });
  }

  // Sort by member count descending for stable ordering
  clusters.sort((a, b) => b.memberCount - a.memberCount);
  // Re-assign stable IDs after sort
  clusters.forEach((cl, i) => {
    cl.id = `cluster-${i}`;
  });

  return { clusters, silhouetteScore: actualSilhouette, k: bestK };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function euclideanDistSq(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sum += d * d;
  }
  return sum;
}

function euclideanDist(a: number[], b: number[]): number {
  return Math.sqrt(euclideanDistSq(a, b));
}

function findDominantDimension(centroid: number[]): AlignmentDimension {
  let maxDev = 0;
  let maxIdx = 0;
  for (let i = 0; i < Math.min(centroid.length, DIMENSION_ORDER.length); i++) {
    const dev = Math.abs((centroid[i] ?? 50) - 50);
    if (dev > maxDev) {
      maxDev = dev;
      maxIdx = i;
    }
  }
  return DIMENSION_ORDER[maxIdx];
}
