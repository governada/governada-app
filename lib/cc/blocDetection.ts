/**
 * Bloc Detection for CC Members
 *
 * Uses connected-components clustering on constitutional reasoning similarity
 * (Jaccard overlap of cited articles). Vote agreement is near-uniform (~99.8%)
 * so reasoning similarity is the primary clustering metric.
 *
 * Algorithm: members are connected if reasoning_similarity_pct >= threshold.
 * Connected components with >= 2 members form a bloc; singletons = "Independent".
 */

export interface AgreementEntry {
  memberA: string;
  memberB: string;
  voteAgreementPct: number;
  reasoningSimilarityPct: number;
  totalSharedProposals: number;
  agreedCount: number;
  disagreedCount: number;
}

export interface BlocAssignment {
  blocLabel: string;
  members: string[];
  internalAgreementPct: number;
}

const DEFAULT_THRESHOLD = 70;

/**
 * Detect blocs among CC members using connected components on reasoning similarity.
 *
 * @param agreements - Pairwise agreement entries between CC members
 * @param threshold  - Minimum reasoning similarity % to consider two members connected (default 70)
 * @returns Array of bloc assignments (components with >=2 members get labels "Bloc A", "Bloc B", etc.;
 *          singletons get "Independent")
 */
export function detectBlocs(
  agreements: AgreementEntry[],
  threshold: number = DEFAULT_THRESHOLD,
): BlocAssignment[] {
  // Collect all unique member IDs
  const memberSet = new Set<string>();
  for (const a of agreements) {
    memberSet.add(a.memberA);
    memberSet.add(a.memberB);
  }
  const members = Array.from(memberSet);

  if (members.length === 0) return [];

  // Union-Find data structure
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();

  for (const m of members) {
    parent.set(m, m);
    rank.set(m, 0);
  }

  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    // Path compression
    let current = x;
    while (current !== root) {
      const next = parent.get(current)!;
      parent.set(current, root);
      current = next;
    }
    return root;
  }

  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;

    const rankA = rank.get(rootA)!;
    const rankB = rank.get(rootB)!;
    if (rankA < rankB) {
      parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      parent.set(rootB, rootA);
    } else {
      parent.set(rootB, rootA);
      rank.set(rootA, rankA + 1);
    }
  }

  // Connect members whose reasoning similarity meets the threshold
  for (const a of agreements) {
    if (a.reasoningSimilarityPct >= threshold) {
      union(a.memberA, a.memberB);
    }
  }

  // Group members by their component root
  const components = new Map<string, string[]>();
  for (const m of members) {
    const root = find(m);
    const group = components.get(root) ?? [];
    group.push(m);
    components.set(root, group);
  }

  // Build a lookup for pairwise reasoning similarity
  const pairKey = (a: string, b: string): string => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const similarityMap = new Map<string, number>();
  for (const a of agreements) {
    similarityMap.set(pairKey(a.memberA, a.memberB), a.reasoningSimilarityPct);
  }

  // Assign labels: multi-member components get "Bloc A", "Bloc B", etc.
  const results: BlocAssignment[] = [];
  let blocIndex = 0;
  const blocLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Sort components by size descending for consistent labeling
  const sortedComponents = Array.from(components.values()).sort((a, b) => b.length - a.length);

  for (const componentMembers of sortedComponents) {
    if (componentMembers.length >= 2) {
      const label = `Bloc ${blocLabels[blocIndex] ?? String(blocIndex)}`;
      blocIndex++;

      // Compute internal agreement as average reasoning similarity among all pairs
      let totalSim = 0;
      let pairCount = 0;
      for (let i = 0; i < componentMembers.length; i++) {
        for (let j = i + 1; j < componentMembers.length; j++) {
          const key = pairKey(componentMembers[i], componentMembers[j]);
          const sim = similarityMap.get(key) ?? 0;
          totalSim += sim;
          pairCount++;
        }
      }

      results.push({
        blocLabel: label,
        members: componentMembers.sort(),
        internalAgreementPct: pairCount > 0 ? Math.round((totalSim / pairCount) * 100) / 100 : 0,
      });
    } else {
      results.push({
        blocLabel: 'Independent',
        members: componentMembers,
        internalAgreementPct: 100,
      });
    }
  }

  return results;
}
