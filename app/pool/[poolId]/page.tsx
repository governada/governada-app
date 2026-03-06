import { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageViewTracker } from '@/components/PageViewTracker';
import { PoolProfileClient } from '@/components/PoolProfileClient';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import { ArrowLeft, BarChart3, MessageSquare, ExternalLink } from 'lucide-react';
import type { AlignmentScores } from '@/lib/drepIdentity';
import nextDynamic from 'next/dynamic';
import { TierThemeProvider } from '@/components/providers/TierThemeProvider';
import { generateSpoNarrative } from '@/lib/narratives';
import { cn } from '@/lib/utils';

const TierCelebrationManager = nextDynamic(() =>
  import('@/components/civica/shared/TierCelebrationManager').then((m) => m.TierCelebrationManager),
);
import { SpoProfileHero } from '@/components/civica/profiles/SpoProfileHero';
import { SpoProfileTabsV1 } from '@/components/civica/profiles/SpoProfileTabsV1';
import { computeTier, computeTierProgress } from '@/lib/scoring/tiers';
import { tierKey, TIER_BADGE_BG, TIER_SCORE_COLOR } from '@/components/civica/cards/tierStyles';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ poolId: string }>;
}

function formatAda(lovelace: number | string | null | undefined): string {
  if (lovelace == null) return '\u2014';
  const n = typeof lovelace === 'string' ? parseInt(lovelace, 10) : lovelace;
  if (isNaN(n)) return '\u2014';
  const ada = n / 1_000_000;
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(2)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${Math.round(ada / 1_000)}K`;
  return ada.toFixed(0);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { poolId } = await params;
  const poolRow = await getPoolRow(poolId);
  if (!poolRow) {
    const short = poolId.slice(0, 12);
    return {
      title: `SPO ${short}\u2026 Governance Profile \u2014 Civica`,
      description: `Governance participation and voting record for stake pool ${short}\u2026 on Cardano.`,
    };
  }
  const name = (poolRow.pool_name as string) || poolId.slice(0, 12) + '\u2026';
  const score = poolRow.governance_score as number | null;
  const tier = score != null ? computeTier(score) : null;
  const title =
    score != null && tier
      ? `${name} \u2014 SPO Governance Score: ${score} (${tier}) \u2014 Civica`
      : `${name} \u2014 SPO Governance Profile \u2014 Civica`;
  return {
    title,
    description: `SPO governance score, voting record, and alignment data for ${name} on Cardano.`,
  };
}

async function getPoolRow(poolId: string) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('pools')
      .select(
        'pool_id, ticker, pool_name, pledge_lovelace, governance_score, participation_pct, deliberation_pct, consistency_pct, reliability_pct, governance_identity_pct, confidence, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency, delegator_count, live_stake_lovelace, vote_count, governance_statement, current_tier, score_momentum, homepage_url',
      )
      .eq('pool_id', poolId)
      .single();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

async function getGovernanceScoreRank(score: number): Promise<number | null> {
  try {
    const supabase = createClient();
    const { count: aboveCount } = await supabase
      .from('pools')
      .select('*', { count: 'exact', head: true })
      .gt('governance_score', score);
    const { count: totalCount } = await supabase
      .from('pools')
      .select('*', { count: 'exact', head: true })
      .not('governance_score', 'is', null);
    if (aboveCount == null || totalCount == null || totalCount === 0) return null;
    return Math.round(((totalCount - aboveCount) / totalCount) * 100);
  } catch {
    return null;
  }
}

async function getInterBodyAlignment(
  poolId: string,
  votes: { proposal_tx_hash: string; proposal_index: number; vote: string }[],
): Promise<{ drepPct: number | null; ccPct: number | null }> {
  if (votes.length === 0) return { drepPct: null, ccPct: null };
  try {
    const supabase = createClient();
    const txHashes = [...new Set(votes.map((v) => v.proposal_tx_hash))];
    const { data: rows } = await supabase
      .from('inter_body_alignment')
      .select('proposal_tx_hash, proposal_index, drep_yes_pct, drep_no_pct, cc_yes_pct, cc_no_pct')
      .in('proposal_tx_hash', txHashes);
    if (!rows || rows.length === 0) return { drepPct: null, ccPct: null };
    const map = new Map(
      rows.map((r) => [
        `${r.proposal_tx_hash}-${r.proposal_index}`,
        {
          drepMajority:
            (r.drep_yes_pct ?? 0) > (r.drep_no_pct ?? 0)
              ? 'Yes'
              : (r.drep_no_pct ?? 0) > (r.drep_yes_pct ?? 0)
                ? 'No'
                : 'Abstain',
          ccMajority:
            (r.cc_yes_pct ?? 0) > (r.cc_no_pct ?? 0)
              ? 'Yes'
              : (r.cc_no_pct ?? 0) > (r.cc_yes_pct ?? 0)
                ? 'No'
                : 'Abstain',
        },
      ]),
    );
    let drepMatch = 0;
    let drepCompared = 0;
    let ccMatch = 0;
    let ccCompared = 0;
    for (const v of votes) {
      const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
      const maj = map.get(key);
      if (!maj) continue;
      if (maj.drepMajority !== 'Abstain') {
        drepCompared++;
        if (v.vote === maj.drepMajority) drepMatch++;
      }
      if (maj.ccMajority !== 'Abstain') {
        ccCompared++;
        if (v.vote === maj.ccMajority) ccMatch++;
      }
    }
    return {
      drepPct: drepCompared > 0 ? Math.round((drepMatch / drepCompared) * 100) : null,
      ccPct: ccCompared > 0 ? Math.round((ccMatch / ccCompared) * 100) : null,
    };
  } catch {
    return { drepPct: null, ccPct: null };
  }
}

async function getSimilarPools(
  poolId: string,
  alignments: AlignmentScores,
  score: number,
): Promise<
  Array<{
    pool_id: string;
    pool_name: string | null;
    ticker: string | null;
    governance_score: number;
  }>
> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('pools')
      .select('pool_id, pool_name, ticker, governance_score')
      .not('governance_score', 'is', null)
      .neq('pool_id', poolId)
      .gte('governance_score', Math.max(0, score - 15))
      .lte('governance_score', Math.min(100, score + 15))
      .order('governance_score', { ascending: false })
      .limit(3);
    return (data ?? []) as Array<{
      pool_id: string;
      pool_name: string | null;
      ticker: string | null;
      governance_score: number;
    }>;
  } catch {
    return [];
  }
}

function toAlignments(row: Record<string, unknown> | null): AlignmentScores {
  if (!row) {
    return {
      treasuryConservative: null,
      treasuryGrowth: null,
      decentralization: null,
      security: null,
      innovation: null,
      transparency: null,
    };
  }
  return {
    treasuryConservative: (row.alignment_treasury_conservative as number) ?? null,
    treasuryGrowth: (row.alignment_treasury_growth as number) ?? null,
    decentralization: (row.alignment_decentralization as number) ?? null,
    security: (row.alignment_security as number) ?? null,
    innovation: (row.alignment_innovation as number) ?? null,
    transparency: (row.alignment_transparency as number) ?? null,
  };
}

function getLastVotedText(votes: Array<{ block_time: number }>): string | null {
  if (votes.length === 0) return null;
  const latest = votes[0].block_time;
  const now = Date.now() / 1000;
  const diffDays = Math.floor((now - latest) / 86400);
  if (diffDays === 0) return 'Voted today';
  if (diffDays === 1) return 'Voted yesterday';
  if (diffDays < 7) return `Voted ${diffDays} days ago`;
  if (diffDays < 30) return `Voted ${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `Voted ${Math.floor(diffDays / 30)} months ago`;
  return `Last voted ${Math.floor(diffDays / 365)}y ago`;
}

export default async function PoolProfilePage({ params }: PageProps) {
  const { poolId } = await params;
  const supabase = createClient();

  const { data: votes } = await supabase
    .from('spo_votes')
    .select('pool_id, proposal_tx_hash, proposal_index, vote, block_time, epoch')
    .eq('pool_id', poolId)
    .order('block_time', { ascending: false });

  const safeVotes = votes ?? [];

  let proposals: {
    tx_hash: string;
    proposal_index: number;
    title: string;
    proposal_type: string;
  }[] = [];
  if (safeVotes.length > 0) {
    const txHashes = [...new Set(safeVotes.map((v) => v.proposal_tx_hash))];
    const { data } = await supabase
      .from('proposals')
      .select('tx_hash, proposal_index, title, proposal_type')
      .in('tx_hash', txHashes);
    proposals = data ?? [];
  }

  const totalVotes = safeVotes.length;

  const { count: totalProposals } = await supabase
    .from('proposals')
    .select('*', { count: 'exact', head: true });

  const participationRate =
    totalProposals && totalProposals > 0 ? Math.round((totalVotes / totalProposals) * 100) : 0;

  const poolRow = await getPoolRow(poolId);
  const hasScored = poolRow != null;

  const [scoreHistoryRes, scoreRank, interBody] = await Promise.all([
    hasScored
      ? supabase
          .from('spo_score_snapshots')
          .select('epoch_no, governance_score, participation_rate')
          .eq('pool_id', poolId)
          .order('epoch_no', { ascending: false })
          .limit(20)
      : Promise.resolve({
          data: [] as Array<{
            epoch_no: number;
            governance_score: number | null;
            participation_rate: number | null;
          }>,
        }),
    hasScored && poolRow?.governance_score != null
      ? getGovernanceScoreRank(poolRow.governance_score)
      : Promise.resolve(null),
    getInterBodyAlignment(poolId, safeVotes),
  ]);

  const scoreSnapshots = scoreHistoryRes.data ?? [];
  const sortedSnapshots = [...scoreSnapshots].reverse();

  // Unscored pool fallback
  if (!hasScored) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8">
        <PageViewTracker event="pool_profile_viewed" properties={{ pool_id: poolId }} />

        <Link href="/discover">
          <Button variant="ghost" className="gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Discover
          </Button>
        </Link>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">SPO Governance Profile</h1>
          <p className="font-mono text-sm text-muted-foreground break-all">{poolId}</p>
        </div>

        {totalVotes === 0 ? (
          <Card>
            <CardContent className="py-16 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">
                This pool hasn&apos;t participated in governance yet.
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Governance scores are calculated after a pool casts its first vote on a governance
                proposal.
              </p>
            </CardContent>
          </Card>
        ) : (
          <PoolProfileClient votes={safeVotes} proposals={proposals} />
        )}
      </div>
    );
  }

  // ── Scored pool: full profile ──────────────────────────────────────────────

  const displayName = (poolRow.pool_name as string) || poolId.slice(0, 16) + '\u2026';
  const ticker = (poolRow.ticker as string) || null;
  const governanceScore = (poolRow.governance_score as number) ?? 0;
  const delegatorCount = (poolRow.delegator_count as number) ?? 0;
  const liveStake = poolRow.live_stake_lovelace;
  const pledge = poolRow.pledge_lovelace;
  const voteCount = (poolRow.vote_count as number) ?? totalVotes;
  const participationPillar = (poolRow.participation_pct as number) ?? participationRate;
  const deliberationPillar = (poolRow.deliberation_pct as number) ?? null;
  const reliabilityPillar = (poolRow.reliability_pct as number) ?? null;
  const governanceIdentityPillar = (poolRow.governance_identity_pct as number) ?? null;
  const poolConfidence = (poolRow.confidence as number) ?? null;
  const governanceStatement = (poolRow.governance_statement as string) ?? null;
  const homepage = (poolRow.homepage_url as string) ?? null;
  const alignments = toAlignments(poolRow);
  const scoreMomentum = (poolRow.score_momentum as number) ?? null;

  const tier = computeTier(governanceScore);
  const tk = tierKey(tier);
  const tierProgress = computeTierProgress(governanceScore);
  const lastVotedText = getLastVotedText(safeVotes);

  // Generate narrative
  const liveStakeAda =
    liveStake != null
      ? (typeof liveStake === 'string' ? parseInt(liveStake, 10) : (liveStake as number)) /
        1_000_000
      : 0;

  const narrative = generateSpoNarrative({
    poolName: displayName,
    ticker,
    governanceScore,
    participationRate,
    voteCount,
    delegatorCount,
    liveStakeAda,
    alignments,
    isClaimed: false,
    governanceStatement,
    scoreMomentum,
  });

  // Similar pools
  const similarPools = await getSimilarPools(poolId, alignments, governanceScore);

  // ── Score Analysis card ────────────────────────────────────────────────────

  const PILLARS = [
    { label: 'Participation', weight: '35%', value: participationPillar, color: 'bg-cyan-500/80' },
    {
      label: 'Deliberation Quality',
      weight: '25%',
      value: deliberationPillar,
      color: 'bg-purple-500/80',
    },
    { label: 'Reliability', weight: '25%', value: reliabilityPillar, color: 'bg-amber-500/80' },
    {
      label: 'Governance Identity',
      weight: '15%',
      value: governanceIdentityPillar,
      color: 'bg-emerald-500/80',
    },
  ];

  const scoreAnalysisCard = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Score Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {poolConfidence != null && poolConfidence < 60 && (
          <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 rounded-md px-3 py-2">
            <span>
              Provisional score \u2014 low confidence ({poolConfidence}%). More votes needed for
              full tier assignment.
            </span>
          </div>
        )}
        {PILLARS.map((p) => (
          <div key={p.label} className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>
                {p.label} \u00B7 {p.weight}
              </span>
              <span className="font-mono tabular-nums">
                {p.value != null ? `${p.value}%` : '\u2014'}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full', p.color)}
                style={{ width: `${Math.min(100, Math.max(0, p.value ?? 0))}%` }}
              />
            </div>
          </div>
        ))}
        {tierProgress.recommendedAction && (
          <p className="text-xs text-muted-foreground border-t pt-3 mt-3">
            {tierProgress.recommendedAction}
          </p>
        )}
      </CardContent>
    </Card>
  );

  // ── Score History (chart-style) ────────────────────────────────────────────

  const trajectoryContent = (
    <div className="space-y-6">
      {sortedSnapshots.length >= 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>Score Trajectory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* SVG sparkline chart */}
              <div className="h-32">
                <svg
                  viewBox={`0 0 ${Math.max(200, sortedSnapshots.length * 30)} 100`}
                  className="w-full h-full"
                  preserveAspectRatio="none"
                >
                  {(() => {
                    const scores = sortedSnapshots.map((s) => s.governance_score ?? 0);
                    const min = Math.min(...scores) - 5;
                    const max = Math.max(...scores) + 5;
                    const range = max - min || 1;
                    const w = Math.max(200, sortedSnapshots.length * 30);
                    const points = sortedSnapshots
                      .map((s, i) => {
                        const x = 10 + (i / Math.max(1, sortedSnapshots.length - 1)) * (w - 20);
                        const y = 90 - (((s.governance_score ?? 0) - min) / range) * 80;
                        return `${x},${y}`;
                      })
                      .join(' ');
                    const trending = scores.length >= 2 && scores[scores.length - 1] >= scores[0];
                    return (
                      <polyline
                        points={points}
                        fill="none"
                        stroke={trending ? '#34d399' : '#fb7185'}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  })()}
                </svg>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums px-2">
                <span>Epoch {sortedSnapshots[0]?.epoch_no}</span>
                <span>Epoch {sortedSnapshots[sortedSnapshots.length - 1]?.epoch_no}</span>
              </div>
              {/* Table below chart */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Epoch</th>
                      <th className="pb-2 pr-4">Score</th>
                      <th className="pb-2 pr-4">Participation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...sortedSnapshots]
                      .reverse()
                      .slice(0, 10)
                      .map((s) => (
                        <tr key={s.epoch_no} className="border-b border-border/50">
                          <td className="py-2 pr-4 font-mono">{s.epoch_no}</td>
                          <td className="py-2 pr-4 font-mono tabular-nums">
                            {s.governance_score ?? '\u2014'}
                          </td>
                          <td className="py-2 pr-4 font-mono tabular-nums">
                            {s.participation_rate != null ? `${s.participation_rate}%` : '\u2014'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Score history builds over time. Check back after the next scoring epoch.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ── Inter-body alignment content ───────────────────────────────────────────

  const interBodyContent = (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Inter-Body Alignment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {interBody.drepPct != null && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Agrees with DRep majority</span>
                <span className="font-mono tabular-nums font-bold text-cyan-400">
                  {interBody.drepPct}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-cyan-500/80"
                  style={{ width: `${interBody.drepPct}%` }}
                />
              </div>
            </div>
          )}
          {interBody.ccPct != null && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Agrees with CC majority</span>
                <span className="font-mono tabular-nums font-bold text-violet-400">
                  {interBody.ccPct}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-500/80"
                  style={{ width: `${interBody.ccPct}%` }}
                />
              </div>
            </div>
          )}
          {interBody.drepPct == null && interBody.ccPct == null && (
            <p className="text-sm text-muted-foreground">
              Inter-body alignment data requires overlapping votes with DReps and CC members.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Alignment Radar in inter-body context */}
      {(alignments.treasuryConservative != null || alignments.decentralization != null) && (
        <Card>
          <CardHeader>
            <CardTitle>Governance Alignment</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <GovernanceRadar alignments={alignments} size="full" />
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ── Community content ──────────────────────────────────────────────────────

  const communityContent = (
    <div className="space-y-6">
      {/* Governance Statement */}
      {governanceStatement && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Governance Statement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {governanceStatement}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pool info */}
      <Card>
        <CardHeader>
          <CardTitle>Pool Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {pledge != null && (
              <div>
                <p className="text-xs text-muted-foreground">Pledge</p>
                <p className="text-sm font-mono tabular-nums font-medium">
                  {formatAda(pledge)} \u20B3
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Live Stake</p>
              <p className="text-sm font-mono tabular-nums font-medium">
                {formatAda(liveStake)} \u20B3
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Delegators</p>
              <p className="text-sm font-mono tabular-nums font-medium">
                {delegatorCount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Governance Votes</p>
              <p className="text-sm font-mono tabular-nums font-medium">{voteCount}</p>
            </div>
          </div>
          {homepage && (
            <a
              href={homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Pool homepage
            </a>
          )}
        </CardContent>
      </Card>

      {/* Similar SPOs */}
      {similarPools.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Similar SPOs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {similarPools.map((p) => {
                const pTier = computeTier(p.governance_score);
                const pTk = tierKey(pTier);
                return (
                  <Link
                    key={p.pool_id}
                    href={`/pool/${p.pool_id}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">
                        {p.pool_name || p.ticker || p.pool_id.slice(0, 12) + '\u2026'}
                      </span>
                      {p.ticker && (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-cyan-500 border-cyan-500/30 shrink-0"
                        >
                          {p.ticker.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span
                        className={cn(
                          'text-xs font-bold px-1.5 py-0.5 rounded-full',
                          TIER_BADGE_BG[pTk],
                        )}
                      >
                        {pTier}
                      </span>
                      <span
                        className={cn(
                          'font-mono tabular-nums text-sm font-bold',
                          TIER_SCORE_COLOR[pTk],
                        )}
                      >
                        {p.governance_score}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ── Tier progress bar (below hero) ─────────────────────────────────────────

  const tierProgressBar = tierProgress.pointsToNext != null && (
    <div className="flex items-center gap-3 text-sm">
      <span>
        {tierProgress.pointsToNext} pts to{' '}
        <span className="text-primary font-bold">{tierProgress.nextTier}</span>
      </span>
      <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${tierProgress.percentWithinTier}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {tierProgress.percentWithinTier}% through {tierProgress.currentTier}
      </span>
    </div>
  );

  return (
    <TierThemeProvider score={governanceScore}>
      <div className="container mx-auto px-4 py-8 space-y-8">
        <PageViewTracker event="pool_profile_viewed" properties={{ pool_id: poolId }} />
        <TierCelebrationManager
          entityType="spo"
          entityId={poolId}
          entityName={displayName}
          enabled
          ogImageUrl={`/api/og/staking/${encodeURIComponent(poolId)}`}
          shareUrl={`https://drepscore.io/pool/${encodeURIComponent(poolId)}`}
        />

        <Link href="/discover">
          <Button variant="ghost" className="gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Discover
          </Button>
        </Link>

        {/* VP1: The Story */}
        <SpoProfileHero
          name={displayName}
          ticker={ticker}
          score={governanceScore}
          tier={tier}
          rank={scoreRank}
          delegatorCount={delegatorCount}
          liveStakeFormatted={formatAda(liveStake)}
          voteCount={voteCount}
          participationRate={participationRate}
          alignments={alignments}
          narrative={narrative}
          scoreMomentum={scoreMomentum}
          lastVotedText={lastVotedText}
        />

        {tierProgressBar}

        {/* VP2: The Record */}
        <SpoProfileTabsV1
          poolId={poolId}
          votingRecordContent={<PoolProfileClient votes={safeVotes} proposals={proposals} />}
          scoreAnalysisContent={scoreAnalysisCard}
          trajectoryContent={trajectoryContent}
          interBodyContent={interBodyContent}
          communityContent={communityContent}
        />
      </div>
    </TierThemeProvider>
  );
}
