/**
 * PCA Engine — extracts principal components from the DRep × Proposal vote matrix.
 * Powers the matching engine with empirically-discovered dimensions.
 */

import { Matrix, SVD } from 'ml-matrix';
import { getSupabaseAdmin } from '@/lib/supabase';
import { imputeMatrix } from './voteMatrix';
import type { ProposalClassification } from './classifyProposals';

export interface PCAResult {
  runId: string;
  coordinates: Map<string, number[]>;
  explainedVariance: number[];
  totalExplainedVariance: number;
  loadings: number[][];
  componentLabels: string[];
}

const DEFAULT_COMPONENTS = 6;

/**
 * Run PCA on the vote matrix. Returns per-DRep coordinates in PCA space.
 */
export function computePCA(
  rawMatrix: number[][],
  drepIds: string[],
  proposalIds: string[],
  classifications: ProposalClassification[],
  opts?: { components?: number },
): PCAResult | null {
  if (rawMatrix.length < 3 || rawMatrix[0]?.length < 3) {
    console.warn('[PCA] Matrix too small for meaningful analysis');
    return null;
  }

  const k = Math.min(
    opts?.components ?? DEFAULT_COMPONENTS,
    rawMatrix.length - 1,
    rawMatrix[0].length - 1,
  );

  // Mean-impute NaN values
  const imputed = imputeMatrix(rawMatrix);

  // Center the matrix (subtract column means)
  const mat = new Matrix(imputed);
  const colMeans = mat.mean('column');
  for (let i = 0; i < mat.rows; i++) {
    for (let j = 0; j < mat.columns; j++) {
      mat.set(i, j, mat.get(i, j) - colMeans[j]);
    }
  }

  // SVD decomposition
  const svd = new SVD(mat, { autoTranspose: true });
  const S = svd.diagonal;
  const V = svd.rightSingularVectors;

  // Explained variance from singular values
  const totalVariance = S.reduce((sum, s) => sum + s * s, 0);
  const explainedVariance = S.slice(0, k).map((s) => (s * s) / totalVariance);
  const totalExplainedVariance = explainedVariance.reduce((a, b) => a + b, 0);

  // Loadings: V columns (proposal × component)
  const loadings: number[][] = [];
  for (let c = 0; c < k; c++) {
    const col: number[] = [];
    for (let j = 0; j < V.rows; j++) {
      col.push(V.get(j, c));
    }
    loadings.push(col);
  }

  // Project DReps into PCA space: scores = centered_matrix × V[:, :k]
  const coordinates = new Map<string, number[]>();
  for (let i = 0; i < drepIds.length; i++) {
    const coords: number[] = [];
    for (let c = 0; c < k; c++) {
      let sum = 0;
      for (let j = 0; j < mat.columns; j++) {
        sum += mat.get(i, j) * V.get(j, c);
      }
      coords.push(sum);
    }
    coordinates.set(drepIds[i], coords);
  }

  // Generate component labels from loadings
  const componentLabels = generateComponentLabels(loadings, proposalIds, classifications);

  return {
    runId: crypto.randomUUID(),
    coordinates,
    explainedVariance,
    totalExplainedVariance,
    loadings,
    componentLabels,
  };
}

/**
 * Phase 3C: Map PCA components to human-readable labels based on loadings.
 */
function generateComponentLabels(
  loadings: number[][],
  proposalIds: string[],
  classifications: ProposalClassification[],
): string[] {
  const classMap = new Map<string, ProposalClassification>();
  for (const c of classifications) {
    classMap.set(`${c.proposalTxHash}-${c.proposalIndex}`, c);
  }

  const dimNames = [
    'Treasury Conservative',
    'Treasury Growth',
    'Decentralization',
    'Security',
    'Innovation',
    'Transparency',
  ];
  const dimKeys: (keyof ProposalClassification)[] = [
    'dimTreasuryConservative',
    'dimTreasuryGrowth',
    'dimDecentralization',
    'dimSecurity',
    'dimInnovation',
    'dimTransparency',
  ];

  return loadings.map((componentLoadings, componentIdx) => {
    // For each component, compute correlation with each dimension's proposal relevance
    const dimCorrelations = dimKeys.map((dimKey, dimIdx) => {
      let sum = 0;
      let count = 0;

      for (let j = 0; j < proposalIds.length; j++) {
        const cls = classMap.get(proposalIds[j]);
        if (!cls) continue;
        const relevance = cls[dimKey] as number;
        const loading = Math.abs(componentLoadings[j]);
        sum += relevance * loading;
        count++;
      }

      return { dim: dimNames[dimIdx], score: count > 0 ? sum / count : 0 };
    });

    dimCorrelations.sort((a, b) => b.score - a.score);

    // Label with top 1-2 dimensions
    if (dimCorrelations[0].score < 0.01) {
      return `Component ${componentIdx + 1}`;
    }

    const primary = dimCorrelations[0].dim;
    if (dimCorrelations.length > 1 && dimCorrelations[1].score > dimCorrelations[0].score * 0.5) {
      return `${primary} / ${dimCorrelations[1].dim}`;
    }

    return primary;
  });
}

/**
 * Persist PCA results to Supabase. Deactivates previous active run.
 */
export async function storePCAResults(
  result: PCAResult,
  proposalIds: string[],
  numDreps: number,
  numProposals: number,
): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Deactivate previous active run
  await supabase.from('pca_results').update({ is_active: false }).eq('is_active', true);

  // Insert new run
  await supabase.from('pca_results').insert({
    run_id: result.runId,
    computed_at: new Date().toISOString(),
    num_dreps: numDreps,
    num_proposals: numProposals,
    components: result.explainedVariance.length,
    explained_variance: result.explainedVariance,
    total_explained_variance: result.totalExplainedVariance,
    loadings: result.loadings,
    proposal_ids: proposalIds,
    is_active: true,
  });

  // Insert DRep coordinates
  const coordRows = [...result.coordinates.entries()].map(([drepId, coords]) => ({
    drep_id: drepId,
    run_id: result.runId,
    coordinates: coords,
    updated_at: new Date().toISOString(),
  }));

  // Batch insert in chunks of 500
  for (let i = 0; i < coordRows.length; i += 500) {
    const chunk = coordRows.slice(i, i + 500);
    await supabase.from('drep_pca_coordinates').upsert(chunk, { onConflict: 'drep_id,run_id' });
  }

  console.log(
    `[PCA] Stored run ${result.runId}: ${numDreps} DReps, ${result.explainedVariance.length} components, ${(result.totalExplainedVariance * 100).toFixed(1)}% variance explained`,
  );
}

/**
 * Load the active PCA run's loadings + proposal order for user projection.
 */
export async function loadActivePCA(): Promise<{
  runId: string;
  loadings: number[][];
  proposalIds: string[];
  explainedVariance: number[];
} | null> {
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from('pca_results')
    .select('run_id, loadings, proposal_ids, explained_variance')
    .eq('is_active', true)
    .single();

  if (!data) return null;

  return {
    runId: data.run_id,
    loadings: data.loadings as number[][],
    proposalIds: data.proposal_ids as string[],
    explainedVariance: data.explained_variance as number[],
  };
}
