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
  const short = poolId.slice(0, 12);
  return {
    title: `SPO ${short}… Governance Profile — DRepScore`,
    description: `Governance participation and voting record for stake pool ${short}… on Cardano.`,
  };
}

async function getPoolRow(poolId: string) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('pools')
      .select(
        'pool_id, ticker, pool_name, pledge, governance_score, participation_rate, consistency_score, reliability_score, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency, delegator_count, live_stake, vote_count',
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
  const participationPillar = (poolRow.participation_rate as number) ?? participationRate;
  const consistencyPillar = (poolRow.consistency_score as number) ?? null;
  const reliabilityPillar = (poolRow.reliability_score as number) ?? null;
  const alignments = toAlignments(poolRow);

  const hasAnyAlignment =
    alignments.treasuryConservative != null ||
    alignments.treasuryGrowth != null ||
    alignments.decentralization != null ||
    alignments.security != null ||
    alignments.innovation != null ||
    alignments.transparency != null;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageViewTracker event="pool_profile_viewed" properties={{ pool_id: poolId }} />

      <Link href="/discover">
        <Button variant="ghost" className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Discover
        </Button>
      </Link>

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
        </div>
      </div>

      <div className="space-y-6 pt-4 border-t">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Score Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Participation · 45%</span>
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
                <span>Consistency · 30%</span>
                <span className="font-mono tabular-nums">
                  {consistencyPillar != null ? consistencyPillar : '—'}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-500/80"
                  style={{ width: `${Math.min(100, Math.max(0, consistencyPillar ?? 0))}%` }}
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
          </CardContent>
        </Card>

        {sortedSnapshots.length > 0 && (
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
        )}

        <PoolProfileClient votes={safeVotes} proposals={proposals} />
      </div>
    </div>
  );
}
