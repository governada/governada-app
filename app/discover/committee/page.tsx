import { Metadata } from 'next';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageViewTracker } from '@/components/PageViewTracker';
import Link from 'next/link';
import { ArrowLeft, Users, ShieldCheck, Activity } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Constitutional Committee — DRepScore',
  description:
    'Explore Constitutional Committee members, transparency scores, and governance voting records on Cardano.',
};

export const dynamic = 'force-dynamic';

interface CivicaMemberAgg {
  ccHotId: string;
  voteCount: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  approvalRate: number;
  transparencyScore: number;
  drepAlignmentPct: number | null;
  participationRate: number;
}

interface AlignmentTensionProposal {
  txHash: string;
  proposalIndex: number;
  drepMajority: string;
  ccVote: string;
}

function computeDrepAlignment(
  memberVotes: { proposal_tx_hash: string; proposal_index: number; vote: string }[],
  alignmentMap: Map<string, { drepMajority: string }>,
): number | null {
  let matched = 0;
  let compared = 0;
  for (const v of memberVotes) {
    const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
    const alignment = alignmentMap.get(key);
    if (!alignment) continue;
    if (alignment.drepMajority !== 'Abstain') {
      compared++;
      if (v.vote === alignment.drepMajority) matched++;
    }
  }
  return compared > 0 ? Math.round((matched / compared) * 100) : null;
}

export default async function CivicaCommitteePage() {
  const supabase = createClient();

  const [{ data: votes }, { count: totalProposals }, { data: alignmentRows }] = await Promise.all([
    supabase.from('cc_votes').select('cc_hot_id, proposal_tx_hash, proposal_index, vote'),
    supabase.from('proposals').select('*', { count: 'exact', head: true }),
    supabase
      .from('inter_body_alignment')
      .select('proposal_tx_hash, proposal_index, drep_yes_pct, drep_no_pct'),
  ]);

  const safeVotes = votes ?? [];
  const safeTotalProposals = totalProposals ?? 0;

  // Build alignment map: proposalKey → drepMajority
  const alignmentMap = new Map<string, { drepMajority: string }>();
  for (const row of alignmentRows ?? []) {
    const key = `${row.proposal_tx_hash}-${row.proposal_index}`;
    const drepMajority =
      row.drep_yes_pct > row.drep_no_pct
        ? 'Yes'
        : row.drep_no_pct > row.drep_yes_pct
          ? 'No'
          : 'Abstain';
    alignmentMap.set(key, { drepMajority });
  }

  // Group votes by member
  const memberVotesMap = new Map<
    string,
    { proposal_tx_hash: string; proposal_index: number; vote: string }[]
  >();
  for (const v of safeVotes) {
    const existing = memberVotesMap.get(v.cc_hot_id) ?? [];
    existing.push({
      proposal_tx_hash: v.proposal_tx_hash,
      proposal_index: v.proposal_index,
      vote: v.vote,
    });
    memberVotesMap.set(v.cc_hot_id, existing);
  }

  // Aggregate per member
  const members: CivicaMemberAgg[] = Array.from(memberVotesMap.entries())
    .map(([ccHotId, memberVotes]) => {
      let yes = 0,
        no = 0,
        abstain = 0;
      for (const v of memberVotes) {
        if (v.vote === 'Yes') yes++;
        else if (v.vote === 'No') no++;
        else abstain++;
      }
      const voteCount = yes + no + abstain;
      const approvalRate = voteCount > 0 ? Math.round((yes / voteCount) * 100) : 0;
      const participationRate = safeTotalProposals > 0 ? (voteCount / safeTotalProposals) * 100 : 0;
      const drepAlignmentPct = computeDrepAlignment(memberVotes, alignmentMap);
      const transparencyScore = Math.round(
        0.7 * Math.min(100, participationRate) + 0.3 * (drepAlignmentPct ?? 50),
      );
      return {
        ccHotId,
        voteCount,
        yesCount: yes,
        noCount: no,
        abstainCount: abstain,
        approvalRate,
        participationRate,
        drepAlignmentPct,
        transparencyScore,
      };
    })
    .sort((a, b) => b.transparencyScore - a.transparencyScore);

  const totalMembers = members.length;
  const totalVotes = safeVotes.length;

  // Unanimous rate
  const proposalVoteCounts = new Map<string, Map<string, string>>();
  for (const v of safeVotes) {
    const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
    const voteMap = proposalVoteCounts.get(key) ?? new Map<string, string>();
    voteMap.set(v.cc_hot_id, v.vote);
    proposalVoteCounts.set(key, voteMap);
  }

  let unanimousCount = 0;
  const tensionProposals: AlignmentTensionProposal[] = [];

  for (const [proposalKey, voteMap] of proposalVoteCounts) {
    const allVotes = Array.from(voteMap.values());
    if (allVotes.length < totalMembers || totalMembers === 0) continue;
    const firstVote = allVotes[0];
    const isUnanimous = allVotes.every((v) => v === firstVote);
    if (isUnanimous) {
      unanimousCount++;
      // Check alignment tension
      const alignment = alignmentMap.get(proposalKey);
      if (
        alignment &&
        alignment.drepMajority !== 'Abstain' &&
        firstVote !== alignment.drepMajority
      ) {
        const [txHash, idxStr] = proposalKey.split(/-(?=\d+$)/);
        tensionProposals.push({
          txHash,
          proposalIndex: parseInt(idxStr ?? '0', 10),
          drepMajority: alignment.drepMajority,
          ccVote: firstVote,
        });
      }
    }
  }

  const unanimousRate =
    proposalVoteCounts.size > 0 ? Math.round((unanimousCount / proposalVoteCounts.size) * 100) : 0;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageViewTracker event="civica_committee_page_viewed" />

      {/* Back nav */}
      <Link
        href="/discover"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Discover
      </Link>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Constitutional Committee</h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          The Constitutional Committee ensures governance proposals align with the Cardano
          Constitution. Transparency scores reflect participation rate and alignment with DRep
          majority positions.
        </p>
      </div>

      {totalVotes === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-sm">
              No Constitutional Committee votes have been recorded yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Active Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totalMembers}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Total Votes Cast
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totalVotes.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Unanimous Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{unanimousRate}%</p>
                <p className="text-xs text-muted-foreground">
                  {unanimousCount} of {proposalVoteCounts.size} proposals
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Members table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Member Transparency</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left px-4 py-3 font-medium">Member ID</th>
                      <th className="text-right px-4 py-3 font-medium">Votes</th>
                      <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">
                        Yes / No / Abs
                      </th>
                      <th className="text-right px-4 py-3 font-medium hidden md:table-cell">
                        Approval
                      </th>
                      <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">
                        DRep Align
                      </th>
                      <th className="px-4 py-3 font-medium w-40">Transparency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr
                        key={m.ccHotId}
                        className="border-b last:border-0 hover:bg-muted/40 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-foreground/80">
                          {m.ccHotId.slice(0, 12)}…{m.ccHotId.slice(-6)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{m.voteCount}</td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                          <span className="text-emerald-500">{m.yesCount}</span>
                          <span className="text-muted-foreground mx-0.5">/</span>
                          <span className="text-rose-500">{m.noCount}</span>
                          <span className="text-muted-foreground mx-0.5">/</span>
                          <span className="text-amber-500">{m.abstainCount}</span>
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell tabular-nums">
                          {m.approvalRate}%
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell tabular-nums">
                          {m.drepAlignmentPct !== null ? (
                            <Badge variant="outline" className="text-xs font-mono">
                              {m.drepAlignmentPct}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-cyan-500/80"
                                style={{ width: `${m.transparencyScore}%` }}
                              />
                            </div>
                            <span className="text-sm font-mono tabular-nums w-8 text-right">
                              {m.transparencyScore}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Alignment Tension section */}
          {tensionProposals.length > 0 && (
            <Card className="border-amber-500/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="text-amber-500">⚡</span>
                  Alignment Tension
                  <Badge variant="outline" className="text-amber-500 border-amber-500/40 text-xs">
                    {tensionProposals.length}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {tensionProposals.length} proposal
                  {tensionProposals.length !== 1 ? 's' : ''} where the CC voted unanimously opposite
                  the DRep majority position.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left px-4 py-3 font-medium">Proposal</th>
                        <th className="text-right px-4 py-3 font-medium">DRep Majority</th>
                        <th className="text-right px-4 py-3 font-medium">CC Vote</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tensionProposals.map((t) => (
                        <tr
                          key={`${t.txHash}-${t.proposalIndex}`}
                          className="border-b last:border-0 hover:bg-muted/40 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-foreground/80">
                            {t.txHash.slice(0, 12)}…{t.txHash.slice(-6)}
                            <span className="text-muted-foreground ml-1">#{t.proposalIndex}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Badge
                              variant="outline"
                              className={
                                t.drepMajority === 'Yes'
                                  ? 'text-emerald-500 border-emerald-500/40'
                                  : 'text-rose-500 border-rose-500/40'
                              }
                            >
                              {t.drepMajority}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Badge
                              variant="outline"
                              className={
                                t.ccVote === 'Yes'
                                  ? 'text-emerald-500 border-emerald-500/40'
                                  : 'text-rose-500 border-rose-500/40'
                              }
                            >
                              {t.ccVote}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
