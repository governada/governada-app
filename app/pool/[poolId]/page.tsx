import { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageViewTracker } from '@/components/PageViewTracker';
import { PoolProfileClient } from '@/components/PoolProfileClient';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import { ArrowLeft, TrendingUp, BarChart3 } from 'lucide-react';
import type { AlignmentScores } from '@/lib/drepIdentity';
import { getFeatureFlag } from '@/lib/featureFlags';
import { TierThemeProvider } from '@/components/providers/TierThemeProvider';
import { SpoProfileTabsV1 } from '@/components/civica/profiles/SpoProfileTabsV1';
import { computeTier, computeTierProgress } from '@/lib/scoring/tiers';
import { tierKey, TIER_BADGE_BG, TIER_SCORE_COLOR } from '@/components/civica/cards/tierStyles';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ poolId: string }>;
}

function formatAda(lovelace: number | string | null | undefined): string {
  if (lovelace == null) return '—';
  const n = typeof lovelace === 'string' ? parseInt(lovelace, 10) : lovelace;
  if (isNaN(n)) return '—';
  const ada = n / 1_000_000;
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(2)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${Math.round(ada / 1_000)}K`;
  return ada.toFixed(0);
}

function formatPledge(lovelace: number | string | null | undefined): string {
  return formatAda(lovelace);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { poolId } = await params;
  const poolRow = await getPoolRow(poolId);
  if (!poolRow) {
    const short = poolId.slice(0, 12);
    return {
      title: `SPO ${short}… Governance Profile — DRepScore`,
      description: `Governance participation and voting record for stake pool ${short}… on Cardano.`,
    };
  }
  const name = (poolRow.pool_name as string) || poolId.slice(0, 12) + '…';
  const score = poolRow.governance_score as number | null;
  const tier = score != null ? computeTier(score) : null;
  const title =
    score != null && tier
      ? `${name} — SPO Governance Score: ${score} (${tier}) — DRepScore`
      : `${name} — SPO Governance Profile — DRepScore`;
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
        'pool_id, ticker, pool_name, pledge, governance_score, participation_pct, deliberation_pct, consistency_pct, reliability_pct, governance_identity_pct, confidence, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency, delegator_count, live_stake, vote_count, governance_statement, current_tier, score_momentum',
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

export default async function PoolProfilePage({ params }: PageProps) {
  const { poolId } = await params;
  const supabase = createClient();

  const civicaEnabled = await getFeatureFlag('civica_frontend');

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

  const yesCount = safeVotes.filter((v) => v.vote === 'Yes').length;
  const noCount = safeVotes.filter((v) => v.vote === 'No').length;
  const abstainCount = safeVotes.filter((v) => v.vote === 'Abstain').length;
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
          .limit(10)
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
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground text-sm">
                This pool has no recorded governance votes yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Total Votes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{totalVotes}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Participation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{participationRate}%</p>
                  <p className="text-xs text-muted-foreground">
                    {totalVotes} of {totalProposals ?? '?'} proposals
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Vote Split</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3 text-sm">
                    <span className="text-green-500">{yesCount} Yes</span>
                    <span className="text-red-500">{noCount} No</span>
                    <span className="text-muted-foreground">{abstainCount} Abstain</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Most Active Epoch</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const epochCounts = new Map<number, number>();
                    for (const v of safeVotes) {
                      epochCounts.set(v.epoch, (epochCounts.get(v.epoch) || 0) + 1);
                    }
                    const top = [...epochCounts.entries()].sort((a, b) => b[1] - a[1])[0];
                    return top ? (
                      <p className="text-2xl font-bold">
                        Epoch {top[0]}{' '}
                        <span className="text-sm font-normal text-muted-foreground">
                          ({top[1]} votes)
                        </span>
                      </p>
                    ) : (
                      <p className="text-muted-foreground">—</p>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>

            <PoolProfileClient votes={safeVotes} proposals={proposals} />
          </>
        )}
      </div>
    );
  }

  const displayName = (poolRow.pool_name as string) || poolId.slice(0, 16) + '…';
  const ticker = (poolRow.ticker as string) || null;
  const governanceScore = (poolRow.governance_score as number) ?? 0;
  const delegatorCount = (poolRow.delegator_count as number) ?? 0;
  const liveStake = poolRow.live_stake;
  const pledge = poolRow.pledge;
  const voteCount = (poolRow.vote_count as number) ?? totalVotes;
  const participationPillar = (poolRow.participation_pct as number) ?? participationRate;
  const deliberationPillar = (poolRow.deliberation_pct as number) ?? null;
  const reliabilityPillar = (poolRow.reliability_pct as number) ?? null;
  const governanceIdentityPillar = (poolRow.governance_identity_pct as number) ?? null;
  const poolConfidence = (poolRow.confidence as number) ?? null;
  const governanceStatement = (poolRow.governance_statement as string) ?? null;
  const alignments = toAlignments(poolRow);

  const hasAnyAlignment =
    alignments.treasuryConservative != null ||
    alignments.treasuryGrowth != null ||
    alignments.decentralization != null ||
    alignments.security != null ||
    alignments.innovation != null ||
    alignments.transparency != null;

  const tier = computeTier(governanceScore);
  const tk = tierKey(tier);
  const tierProgress = computeTierProgress(governanceScore);

  // Score Analysis card (shared between civica and legacy paths)
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
              Provisional score — low confidence ({poolConfidence}%). More votes needed for full
              tier assignment.
            </span>
          </div>
        )}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Participation · 35%</span>
            <span className="font-mono tabular-nums">{participationPillar ?? '—'}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-500/80"
              style={{ width: `${Math.min(100, Math.max(0, participationPillar ?? 0))}%` }}
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Deliberation Quality · 25%</span>
            <span className="font-mono tabular-nums">
              {deliberationPillar != null ? deliberationPillar : '—'}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-purple-500/80"
              style={{ width: `${Math.min(100, Math.max(0, deliberationPillar ?? 0))}%` }}
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Reliability · 25%</span>
            <span className="font-mono tabular-nums">
              {reliabilityPillar != null ? reliabilityPillar : '—'}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500/80"
              style={{ width: `${Math.min(100, Math.max(0, reliabilityPillar ?? 0))}%` }}
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Governance Identity · 15%</span>
            <span className="font-mono tabular-nums">
              {governanceIdentityPillar != null ? `${governanceIdentityPillar}%` : '—'}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500/80"
              style={{
                width: `${Math.min(100, Math.max(0, governanceIdentityPillar ?? 0))}%`,
              }}
            />
          </div>
          {governanceIdentityPillar == null && (
            <p className="text-xs text-muted-foreground">
              Governance identity scoring coming soon.
            </p>
          )}
        </div>
        {tierProgress.recommendedAction && (
          <p className="text-xs text-muted-foreground border-t pt-3 mt-3">
            💡 {tierProgress.recommendedAction}
          </p>
        )}
      </CardContent>
    </Card>
  );

  // Score History card
  const scoreHistoryCard =
    sortedSnapshots.length > 0 ? (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Score History
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                {sortedSnapshots.map((s) => (
                  <tr key={s.epoch_no} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono">{s.epoch_no}</td>
                    <td className="py-2 pr-4 font-mono tabular-nums">
                      {s.governance_score ?? '—'}
                    </td>
                    <td className="py-2 pr-4 font-mono tabular-nums">
                      {s.participation_rate != null ? `${s.participation_rate}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    ) : null;

  // Inter-body card
  const interBodyCard = (
    <Card>
      <CardHeader>
        <CardTitle>Inter-Body Alignment</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {interBody.drepPct != null && (
            <div>
              <span className="text-sm text-muted-foreground">Agrees with DRep majority</span>
              <p className="text-xl font-bold tabular-nums">{interBody.drepPct}%</p>
            </div>
          )}
          {interBody.ccPct != null && (
            <div>
              <span className="text-sm text-muted-foreground">Agrees with CC majority</span>
              <p className="text-xl font-bold tabular-nums">{interBody.ccPct}%</p>
            </div>
          )}
          {interBody.drepPct == null && interBody.ccPct == null && (
            <p className="text-sm text-muted-foreground">
              No inter-body alignment data for proposals this pool voted on.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <TierThemeProvider score={civicaEnabled ? governanceScore : null}>
      <div className="container mx-auto px-4 py-8 space-y-8">
        <PageViewTracker event="pool_profile_viewed" properties={{ pool_id: poolId }} />

        <Link href="/discover">
          <Button variant="ghost" className="gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Discover
          </Button>
        </Link>

        {civicaEnabled ? (
          /* VP1 Civica Hero */
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {displayName.length > 40 ? displayName.slice(0, 40) + '…' : displayName}
                </h1>
                {ticker && (
                  <Badge variant="outline" className="text-cyan-500 border-cyan-500/40 font-mono">
                    {ticker.toUpperCase()}
                  </Badge>
                )}
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIER_BADGE_BG[tk]}`}
                >
                  {tier}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold tabular-nums ${TIER_SCORE_COLOR[tk]}`}>
                  {governanceScore}
                </span>
                <span className="text-muted-foreground text-sm">governance score</span>
                {scoreRank != null && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    Top {100 - scoreRank}% of governance-active SPOs
                  </span>
                )}
              </div>

              {governanceStatement && (
                <p className="text-sm text-muted-foreground italic max-w-2xl">
                  &ldquo;
                  {governanceStatement.length > 150
                    ? governanceStatement.slice(0, 150) + '…'
                    : governanceStatement}
                  &rdquo;
                </p>
              )}
            </div>

            {/* Key fact chips */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4 border-y border-border">
              <div className="flex flex-col items-center text-center min-w-[80px]">
                <span className="text-xs text-muted-foreground">Votes Cast</span>
                <span className="text-sm font-semibold font-mono tabular-nums">{voteCount}</span>
              </div>
              <div className="flex flex-col items-center text-center min-w-[80px]">
                <span className="text-xs text-muted-foreground">Participation</span>
                <span className="text-sm font-semibold font-mono tabular-nums">
                  {participationRate}%
                </span>
              </div>
              <div className="flex flex-col items-center text-center min-w-[80px]">
                <span className="text-xs text-muted-foreground">Delegators</span>
                <span className="text-sm font-semibold font-mono tabular-nums">
                  {delegatorCount.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col items-center text-center min-w-[80px]">
                <span className="text-xs text-muted-foreground">Live Stake</span>
                <span className="text-sm font-semibold font-mono tabular-nums">
                  {formatAda(liveStake)} ₳
                </span>
              </div>
              {interBody.drepPct != null && (
                <div className="flex flex-col items-center text-center min-w-[100px]">
                  <span className="text-xs text-muted-foreground">Agrees w/ DReps</span>
                  <span className="text-sm font-semibold font-mono tabular-nums text-cyan-400">
                    {interBody.drepPct}%
                  </span>
                </div>
              )}
              {interBody.ccPct != null && (
                <div className="flex flex-col items-center text-center min-w-[100px]">
                  <span className="text-xs text-muted-foreground">Agrees w/ CC</span>
                  <span className="text-sm font-semibold font-mono tabular-nums text-violet-400">
                    {interBody.ccPct}%
                  </span>
                </div>
              )}
            </div>

            {/* Governance Radar */}
            {hasAnyAlignment && (
              <Card>
                <CardHeader>
                  <CardTitle>Alignment Radar</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <GovernanceRadar alignments={alignments} size="full" />
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          /* Legacy VP0 header */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {displayName.length > 32 ? displayName.slice(0, 32) + '…' : displayName}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  {ticker && (
                    <Badge variant="outline" className="text-cyan-500 border-cyan-500/40">
                      {ticker.toUpperCase()}
                    </Badge>
                  )}
                  <span className="text-3xl font-bold tabular-nums">{governanceScore}</span>
                  <span className="text-muted-foreground text-sm">governance score</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                  <span>{delegatorCount.toLocaleString()} delegators</span>
                  <span>{formatAda(liveStake)} ADA live stake</span>
                  {pledge != null && <span>{formatPledge(pledge)} ADA pledge</span>}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-4 border-y border-border">
              <div className="flex flex-col items-center text-center min-w-[80px]">
                <span className="text-xs text-muted-foreground">Votes</span>
                <span className="text-sm font-semibold font-mono tabular-nums">{voteCount}</span>
              </div>
              <div className="flex flex-col items-center text-center min-w-[80px]">
                <span className="text-xs text-muted-foreground">Participation</span>
                <span className="text-sm font-semibold font-mono tabular-nums">
                  {participationRate}%
                </span>
              </div>
              {scoreRank != null && (
                <div className="flex flex-col items-center text-center min-w-[80px]">
                  <span className="text-xs text-muted-foreground">Score Rank</span>
                  <span className="text-sm font-semibold font-mono tabular-nums">
                    Top {100 - scoreRank}%
                  </span>
                </div>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {hasAnyAlignment && (
                <Card>
                  <CardHeader>
                    <CardTitle>Alignment Radar</CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <GovernanceRadar alignments={alignments} size="full" />
                  </CardContent>
                </Card>
              )}
              {interBodyCard}
            </div>
          </div>
        )}

        {/* VP2 Section */}
        {civicaEnabled ? (
          <SpoProfileTabsV1
            poolId={poolId}
            votingRecordContent={<PoolProfileClient votes={safeVotes} proposals={proposals} />}
            scoreAnalysisContent={scoreAnalysisCard}
            trajectoryContent={
              <div className="space-y-6">
                {scoreHistoryCard ?? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">No score history yet.</p>
                    </CardContent>
                  </Card>
                )}
                <p className="text-xs text-muted-foreground px-1">
                  Delegator trend data coming soon via /api/spo/{poolId}/trends.
                </p>
              </div>
            }
            interBodyContent={
              <div className="space-y-6">
                {interBodyCard}
                {hasAnyAlignment && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Alignment Radar</CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                      <GovernanceRadar alignments={alignments} size="full" />
                    </CardContent>
                  </Card>
                )}
              </div>
            }
          />
        ) : (
          <div className="space-y-6 pt-4 border-t">
            {scoreAnalysisCard}
            {scoreHistoryCard}
            <PoolProfileClient votes={safeVotes} proposals={proposals} />
          </div>
        )}
      </div>
    </TierThemeProvider>
  );
}
