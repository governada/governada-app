/**
 * AI Quality Measurement Module
 *
 * Measures AI influence on proposal drafting and review quality using
 * semantic embeddings. All functions operate on pre-computed embedding
 * vectors — no API calls or database access here.
 *
 * Gated behind the `embedding_ai_quality` feature flag.
 */

import { cosineSimilarity } from '@/lib/embeddings/query';
import { computePairwiseDiversity, computeCentroid } from '@/lib/embeddings/quality';

/**
 * AI Influence Score (0-100).
 *
 * Compares draft embedding before and after AI skill invocation.
 * Higher = more AI influence on the content.
 *
 * Ranges:
 *  0-20: Light touch-ups (formatting, grammar)
 * 20-50: Structural improvements (reorganization, argument strengthening)
 * 50-100: Substantial rewrite (new content direction)
 */
export function computeAiInfluence(preEmbedding: number[], postEmbedding: number[]): number {
  const similarity = cosineSimilarity(preEmbedding, postEmbedding);
  return (1 - similarity) * 100;
}

/**
 * Originality vs Corpus (0-100).
 *
 * Compares a proposal draft embedding against all existing published
 * proposal embeddings. Higher = more original/unique content.
 *
 * Returns 100 if there are no existing embeddings to compare against.
 */
export function computeOriginality(
  draftEmbedding: number[],
  existingEmbeddings: number[][],
): number {
  if (existingEmbeddings.length === 0) return 100;

  let maxSimilarity = -Infinity;
  for (const existing of existingEmbeddings) {
    const sim = cosineSimilarity(draftEmbedding, existing);
    if (sim > maxSimilarity) maxSimilarity = sim;
  }

  return (1 - maxSimilarity) * 100;
}

/**
 * Review Relevance (0-100).
 *
 * How on-topic is a review annotation relative to the proposal section
 * it's annotating. Higher = more relevant/on-topic.
 */
export function computeReviewRelevance(
  annotationEmbedding: number[],
  sectionEmbedding: number[],
): number {
  return cosineSimilarity(annotationEmbedding, sectionEmbedding) * 100;
}

/**
 * Review Originality (0-100).
 *
 * Does the review add novel concerns vs just paraphrasing the proposal
 * section? Higher = more original insight beyond what the section says.
 */
export function computeReviewOriginality(
  annotationEmbedding: number[],
  sectionEmbedding: number[],
): number {
  return (1 - cosineSimilarity(annotationEmbedding, sectionEmbedding)) * 100;
}

/**
 * Review Diversity (per-proposal).
 *
 * For proposals with 3+ reviews, measures the spread of annotation
 * embeddings. Higher diversity = more distinct perspectives being raised.
 *
 * Uses pairwise diversity and estimates distinct perspective clusters
 * by counting groups of annotations with mutual similarity > 0.8.
 */
export function computeReviewDiversity(annotationEmbeddings: number[][]): {
  diversityScore: number;
  clusterCount: number;
} {
  if (annotationEmbeddings.length < 2) {
    return { diversityScore: 0, clusterCount: annotationEmbeddings.length };
  }

  const diversityScore = computePairwiseDiversity(annotationEmbeddings);

  // Estimate cluster count via greedy clustering:
  // Assign each embedding to the first cluster whose centroid is > 0.8 similar,
  // or create a new cluster.
  const CLUSTER_THRESHOLD = 0.8;
  const clusterCentroids: number[][] = [];

  for (const embedding of annotationEmbeddings) {
    let assigned = false;
    for (const centroid of clusterCentroids) {
      if (cosineSimilarity(embedding, centroid) > CLUSTER_THRESHOLD) {
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      clusterCentroids.push(embedding);
    }
  }

  return {
    diversityScore,
    clusterCount: clusterCentroids.length,
  };
}

/**
 * Homogenization Detection.
 *
 * Compares how tightly AI-assisted proposals cluster vs non-AI proposals.
 * If AI-assisted proposals are more tightly clustered, that indicates
 * the AI is reducing diversity of ideas across the ecosystem.
 *
 * Tightness = 1 - average pairwise distance (lower distance = tighter cluster).
 * homogenizationRisk = true when AI proposals cluster more tightly than non-AI.
 */
export function detectHomogenization(
  aiAssistedEmbeddings: number[][],
  nonAiEmbeddings: number[][],
): {
  aiClusterTightness: number;
  nonAiClusterTightness: number;
  homogenizationRisk: boolean;
} {
  // Need at least 2 embeddings in each group to compare
  const aiDiversity =
    aiAssistedEmbeddings.length >= 2 ? computePairwiseDiversity(aiAssistedEmbeddings) : 0;
  const nonAiDiversity =
    nonAiEmbeddings.length >= 2 ? computePairwiseDiversity(nonAiEmbeddings) : 0;

  // Tightness is inverse of diversity: lower diversity = tighter cluster
  const aiTightness = 1 - aiDiversity;
  const nonAiTightness = 1 - nonAiDiversity;

  // Compute centroid spread as secondary signal
  const aiCentroid =
    aiAssistedEmbeddings.length >= 2 ? computeCentroid(aiAssistedEmbeddings) : null;
  const nonAiCentroid = nonAiEmbeddings.length >= 2 ? computeCentroid(nonAiEmbeddings) : null;

  // homogenizationRisk: AI proposals cluster tighter (higher tightness) than non-AI
  // Only flag when both groups have enough data to compare meaningfully
  const canCompare = aiAssistedEmbeddings.length >= 2 && nonAiEmbeddings.length >= 2;
  const homogenizationRisk = canCompare && aiTightness > nonAiTightness;

  // Suppress unused variable warnings — centroids reserved for future metrics
  void aiCentroid;
  void nonAiCentroid;

  return {
    aiClusterTightness: aiTightness,
    nonAiClusterTightness: nonAiTightness,
    homogenizationRisk,
  };
}
