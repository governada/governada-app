/**
 * Cluster Naming — uses Claude to generate human-readable faction names.
 *
 * Each cluster gets a short name + 1-sentence description based on its
 * centroid dimension weights and dominant alignment.
 */

import { getAnthropicClient, MODELS } from '@/lib/ai';
import { DIMENSION_ORDER } from '@/lib/drepIdentity';
import { logger } from '@/lib/logger';
import type { Cluster } from './clusterDetection';

export interface ClusterName {
  name: string;
  description: string;
}

const DIMENSION_LABELS: Record<string, string> = {
  treasuryConservative: 'Treasury Conservative',
  treasuryGrowth: 'Treasury Growth',
  decentralization: 'Decentralization',
  security: 'Security',
  innovation: 'Innovation',
  transparency: 'Transparency',
};

/**
 * Generate a human-readable name for a governance faction cluster.
 * Falls back to dimension-based name if AI is unavailable.
 */
export async function nameCluster(cluster: Cluster): Promise<ClusterName> {
  const fallback = getFallbackName(cluster);

  try {
    const client = await getAnthropicClient();
    if (!client) return fallback;

    const dimWeights = DIMENSION_ORDER.map(
      (dim, i) => `${DIMENSION_LABELS[dim]}: ${(cluster.centroid6D[i] ?? 50).toFixed(0)}/100`,
    ).join('\n');

    const response = await client.messages.create({
      model: MODELS.HAIKU,
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `You are naming governance factions in Cardano's decentralized governance system.

A cluster of ${cluster.memberCount} DReps (Delegated Representatives) has these alignment centroid scores:
${dimWeights}

Dominant alignment: ${DIMENSION_LABELS[cluster.dominantDimension] ?? cluster.dominantDimension}

Give this faction:
1. A short name (2-3 words, e.g., "Treasury Guardians", "Innovation Vanguard", "Decentralization Advocates"). Be creative but professional.
2. A one-sentence description of what this faction likely prioritizes.

Respond as JSON: {"name": "...", "description": "..."}`,
        },
      ],
    });

    const raw = response.content?.[0]?.type === 'text' ? response.content[0].text : '';
    // Strip markdown code fences Claude may wrap around JSON
    const text = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(text);
    if (parsed.name && parsed.description) {
      return { name: String(parsed.name), description: String(parsed.description) };
    }
    return fallback;
  } catch (err) {
    logger.warn('Cluster naming AI failed, using fallback', { error: String(err) });
    return fallback;
  }
}

/**
 * Name all clusters in batch. Returns a map of clusterId -> ClusterName.
 */
export async function nameAllClusters(clusters: Cluster[]): Promise<Map<string, ClusterName>> {
  const results = new Map<string, ClusterName>();

  // Run in parallel with a concurrency limit of 3
  const batches: Cluster[][] = [];
  for (let i = 0; i < clusters.length; i += 3) {
    batches.push(clusters.slice(i, i + 3));
  }

  for (const batch of batches) {
    const named = await Promise.all(batch.map((c) => nameCluster(c)));
    batch.forEach((c, i) => results.set(c.id, named[i]));
  }

  return results;
}

function getFallbackName(cluster: Cluster): ClusterName {
  const label = DIMENSION_LABELS[cluster.dominantDimension] ?? 'Governance';
  return {
    name: `${label} Faction`,
    description: `A group of ${cluster.memberCount} DReps primarily aligned with ${label.toLowerCase()} priorities.`,
  };
}
