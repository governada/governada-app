import { getSupabaseAdmin } from '@/lib/supabase';
import { detectClusters } from '@/lib/globe/clusterDetection';
import { extractAlignments, alignmentsToArray, getDominantDimension } from '@/lib/drepIdentity';
import type { AlignmentDimension, AlignmentScores } from '@/lib/drepIdentity';
import type { LayoutInput } from '@/lib/constellation/globe-layout';
import type { ResolvedSessionPersona } from '@/lib/governance/derivePersonaFromSession';
import { calculateProgressiveConfidence } from '@/lib/matching/confidence';

export type RegionSuggestionPersona = 'drep' | 'spo' | 'cc' | 'citizen' | 'anonymous';

export type RegionSuggestionAlignmentDimension =
  | 'treasury_conservative'
  | 'treasury_growth'
  | 'decentralization'
  | 'security'
  | 'innovation'
  | 'transparency';

export interface TreasuryBehavior {
  windowDays: 30 | 90 | 180 | 'all_time';
  yesRate: number;
  cumulativeApprovedAda: number;
  proposalsConsidered: number;
}

export interface RegionSuggestionContext {
  cluster: {
    id: string;
    nodeCount: number;
    dominantAlignmentDimension: RegionSuggestionAlignmentDimension;
    recentRationaleCount: number;
    recentVoteCount: number;
    averageScore: number;
    scoreMomentumLastEpoch: number;
    treasuryBehavior?: TreasuryBehavior;
  };
  user: {
    persona: RegionSuggestionPersona;
    delegatedDrepId?: string | null;
    delegatedDrepInCluster?: boolean;
    matchScores?: {
      maxScoreInCluster: number;
      averageScoreInCluster: number;
      aboveSeventyCount: number;
    } | null;
  };
}

interface DrepClusterRow {
  id: string;
  score: number | null;
  score_momentum: number | null;
  info: Record<string, unknown> | null;
  alignment_treasury_conservative: number | null;
  alignment_treasury_growth: number | null;
  alignment_decentralization: number | null;
  alignment_security: number | null;
  alignment_innovation: number | null;
  alignment_transparency: number | null;
}

interface RecentClusterStats {
  recentRationaleCount: number;
  recentVoteCount: number;
}

interface UserGovernanceProfileRow {
  alignment_scores: Record<string, number | null> | null;
  confidence: number | null;
  has_quick_match: boolean | null;
  votes_used: number | null;
}

interface TreasuryBehaviorRpcRow {
  proposals_30d: number | null;
  yes_30d: number | null;
  approved_30d: number | string | null;
  proposals_90d: number | null;
  yes_90d: number | null;
  approved_90d: number | string | null;
  proposals_180d: number | null;
  yes_180d: number | null;
  approved_180d: number | string | null;
  proposals_all_time: number | null;
  yes_all_time: number | null;
  approved_all_time: number | string | null;
}

export interface RegionSuggestionSource {
  readDrepClusterRows: () => Promise<DrepClusterRow[]>;
  readRecentClusterStats: (drepIds: string[], now: Date) => Promise<RecentClusterStats>;
  readTreasuryBehavior: (drepIds: string[]) => Promise<TreasuryBehavior | undefined>;
  readUserGovernanceProfile: (userId: string) => Promise<UserGovernanceProfileRow | null>;
}

export interface BuildRegionSuggestionContextInput {
  clusterId: string;
  persona: ResolvedSessionPersona;
  userId?: string | null;
  now?: Date;
  source?: RegionSuggestionSource;
}

const TREASURY_BEHAVIOR_THRESHOLD = 3;

const DIMENSION_TO_API: Record<AlignmentDimension, RegionSuggestionAlignmentDimension> = {
  treasuryConservative: 'treasury_conservative',
  treasuryGrowth: 'treasury_growth',
  decentralization: 'decentralization',
  security: 'security',
  innovation: 'innovation',
  transparency: 'transparency',
};

export function selectTreasuryBehaviorWindow(
  row: TreasuryBehaviorRpcRow | null | undefined,
): TreasuryBehavior | undefined {
  if (!row) return undefined;

  const windows: TreasuryBehavior[] = [
    toTreasuryBehavior(30, row.proposals_30d, row.yes_30d, row.approved_30d),
    toTreasuryBehavior(90, row.proposals_90d, row.yes_90d, row.approved_90d),
    toTreasuryBehavior(180, row.proposals_180d, row.yes_180d, row.approved_180d),
    toTreasuryBehavior('all_time', row.proposals_all_time, row.yes_all_time, row.approved_all_time),
  ];

  return windows.find((window) => window.proposalsConsidered >= TREASURY_BEHAVIOR_THRESHOLD);
}

export async function buildRegionSuggestionContext({
  clusterId,
  persona,
  userId,
  now = new Date(),
  source = createSupabaseRegionSuggestionSource(),
}: BuildRegionSuggestionContextInput): Promise<RegionSuggestionContext> {
  const drepRows = await source.readDrepClusterRows();
  const clusters = buildClusters(drepRows);
  const cluster = clusters.get(clusterId);

  if (!cluster) {
    throw new Error(`Unknown region-suggestion cluster: ${clusterId}`);
  }

  const [recentStats, treasuryBehavior, matchScores] = await Promise.all([
    source.readRecentClusterStats(cluster.memberIds, now),
    source.readTreasuryBehavior(cluster.memberIds),
    buildMatchScores({
      clusterDreps: cluster.rows,
      persona: persona.persona,
      userId,
      source,
    }),
  ]);

  const delegatedDrepId = persona.delegatedDrepId ?? null;

  return {
    cluster: {
      id: cluster.id,
      nodeCount: cluster.memberIds.length,
      dominantAlignmentDimension: DIMENSION_TO_API[cluster.dominantDimension],
      recentRationaleCount: recentStats.recentRationaleCount,
      recentVoteCount: recentStats.recentVoteCount,
      averageScore: roundNumber(average(cluster.rows.map((row) => Number(row.score ?? 0))), 1),
      scoreMomentumLastEpoch: roundNumber(
        average(cluster.rows.map((row) => Number(row.score_momentum ?? 0))),
        2,
      ),
      ...(treasuryBehavior ? { treasuryBehavior } : {}),
    },
    user: {
      persona: persona.persona,
      delegatedDrepId,
      delegatedDrepInCluster: delegatedDrepId ? cluster.memberIds.includes(delegatedDrepId) : false,
      matchScores,
    },
  };
}

function createSupabaseRegionSuggestionSource(): RegionSuggestionSource {
  const supabase = getSupabaseAdmin();

  return {
    async readDrepClusterRows() {
      const { data, error } = await supabase
        .from('dreps')
        .select(
          'id, score, score_momentum, info, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
        )
        .gt('info->>votingPowerLovelace', '0')
        .order('id')
        .limit(700);

      if (error) throw new Error(`Failed to read DRep cluster rows: ${error.message}`);
      return ((data ?? []) as DrepClusterRow[]).filter((row) => row.id);
    },

    async readRecentClusterStats(drepIds, now) {
      if (drepIds.length === 0) return { recentRationaleCount: 0, recentVoteCount: 0 };
      const thirtyDaysAgoSeconds = Math.floor((now.getTime() - 30 * 24 * 60 * 60 * 1000) / 1000);
      const sevenDaysAgoSeconds = Math.floor((now.getTime() - 7 * 24 * 60 * 60 * 1000) / 1000);

      const { data, error } = await supabase
        .from('drep_votes')
        .select('block_time, has_rationale')
        .in('drep_id', drepIds)
        .gte('block_time', thirtyDaysAgoSeconds);

      if (error) throw new Error(`Failed to read cluster vote stats: ${error.message}`);

      const rows = (data ?? []) as Array<{ block_time: number; has_rationale: boolean | null }>;
      return {
        recentRationaleCount: rows.filter((row) => row.has_rationale).length,
        recentVoteCount: rows.filter((row) => row.block_time >= sevenDaysAgoSeconds).length,
      };
    },

    async readTreasuryBehavior(drepIds) {
      if (drepIds.length === 0) return undefined;
      const { data, error } = await supabase.rpc('get_cluster_treasury_behavior', {
        drep_ids: drepIds,
      });

      if (error) throw new Error(`Failed to read cluster treasury behavior: ${error.message}`);
      const rows = (data ?? []) as TreasuryBehaviorRpcRow[];
      return selectTreasuryBehaviorWindow(rows[0]);
    },

    async readUserGovernanceProfile(profileUserId) {
      const { data, error } = await supabase
        .from('user_governance_profiles')
        .select('alignment_scores, confidence, has_quick_match, votes_used')
        .eq('user_id', profileUserId)
        .maybeSingle();

      if (error) throw new Error(`Failed to read user governance profile: ${error.message}`);
      return (data as UserGovernanceProfileRow | null) ?? null;
    },
  };
}

function buildClusters(drepRows: DrepClusterRow[]) {
  const inputs: LayoutInput[] = drepRows.map((row) => {
    const alignments = extractAlignments(row);
    return {
      id: row.id,
      fullId: row.id,
      name: typeof row.info?.name === 'string' ? row.info.name : null,
      power: 0.5,
      score: Number(row.score ?? 0),
      dominant: getDominantDimension(alignments),
      alignments: alignmentsToArray(alignments),
      nodeType: 'drep',
    };
  });

  const rowsById = new Map(drepRows.map((row) => [row.id, row]));
  const result = detectClusters(inputs);
  return new Map(
    result.clusters.map((cluster) => [
      cluster.id,
      {
        ...cluster,
        rows: cluster.memberIds
          .map((memberId) => rowsById.get(memberId))
          .filter((row): row is DrepClusterRow => !!row),
      },
    ]),
  );
}

async function buildMatchScores({
  clusterDreps,
  persona,
  userId,
  source,
}: {
  clusterDreps: DrepClusterRow[];
  persona: RegionSuggestionPersona;
  userId?: string | null;
  source: RegionSuggestionSource;
}): Promise<RegionSuggestionContext['user']['matchScores']> {
  if (persona !== 'citizen' || !userId) return null;

  try {
    const profile = await source.readUserGovernanceProfile(userId);
    if (!profile?.alignment_scores || (!profile.has_quick_match && !profile.votes_used)) {
      return null;
    }

    const confidence = calculateProgressiveConfidence({
      quizAnswerCount: profile.has_quick_match ? 4 : 0,
      pollVoteCount: profile.votes_used ?? 0,
      proposalTypesVoted: 0,
      engagementActionCount: 0,
      hasDelegation: false,
    });

    if (confidence.overall <= 0) return null;

    const userAlignment = normalizeAlignmentScores(profile.alignment_scores);
    const scores = clusterDreps
      .map((drep) => scoreDrepAgainstProfile(userAlignment, extractAlignments(drep)))
      .filter((score) => Number.isFinite(score));

    if (scores.length === 0) return null;

    return {
      maxScoreInCluster: Math.max(...scores),
      averageScoreInCluster: Math.round(average(scores)),
      aboveSeventyCount: scores.filter((score) => score >= 70).length,
    };
  } catch {
    return null;
  }
}

function normalizeAlignmentScores(scores: Record<string, number | null>): AlignmentScores {
  return {
    treasuryConservative: scores.treasuryConservative ?? scores.treasury_conservative ?? null,
    treasuryGrowth: scores.treasuryGrowth ?? scores.treasury_growth ?? null,
    decentralization: scores.decentralization ?? null,
    security: scores.security ?? null,
    innovation: scores.innovation ?? null,
    transparency: scores.transparency ?? null,
  };
}

function scoreDrepAgainstProfile(userAlignment: AlignmentScores, drepAlignment: AlignmentScores) {
  const user = alignmentsToArray(userAlignment);
  const drep = alignmentsToArray(drepAlignment);
  const perDimension = user.map((value, index) => 100 - Math.abs(value - (drep[index] ?? 50)));
  return Math.max(0, Math.min(100, Math.round(average(perDimension))));
}

function toTreasuryBehavior(
  windowDays: TreasuryBehavior['windowDays'],
  proposals: number | null,
  yes: number | null,
  approved: number | string | null,
): TreasuryBehavior {
  const proposalsConsidered = Number(proposals ?? 0);
  const yesCount = Number(yes ?? 0);
  return {
    windowDays,
    yesRate: proposalsConsidered > 0 ? roundNumber(yesCount / proposalsConsidered, 3) : 0,
    cumulativeApprovedAda: Number(approved ?? 0),
    proposalsConsidered,
  };
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundNumber(value: number, places: number) {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}
