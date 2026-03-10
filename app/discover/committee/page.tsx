import { Metadata } from 'next';
import { createClient } from '@/lib/supabase';
import { getCCMembersTransparency } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageViewTracker } from '@/components/PageViewTracker';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  ShieldCheck,
  Activity,
  Scale,
  BookOpen,
  Info,
  Vote,
  Clock,
  Sparkles,
  MessageCircle,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'CC Transparency Index — Governada',
  description:
    'Constitutional Committee Transparency Index: accountability scores, voting records, and rationale analysis for Cardano governance.',
};

export const dynamic = 'force-dynamic';

function transparencyColor(score: number | null): string {
  if (score == null) return 'text-muted-foreground';
  if (score >= 85) return 'text-emerald-500';
  if (score >= 70) return 'text-cyan-500';
  if (score >= 55) return 'text-amber-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-rose-500';
}

function transparencyBarColor(score: number | null): string {
  if (score == null) return 'bg-muted';
  if (score >= 85) return 'bg-emerald-500/80';
  if (score >= 70) return 'bg-cyan-500/80';
  if (score >= 55) return 'bg-amber-500/80';
  if (score >= 40) return 'bg-orange-500/80';
  return 'bg-rose-500/80';
}

function gradeLabel(score: number): string {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export default async function CommitteeTransparencyPage() {
  const supabase = createClient();

  const [members, { data: votes }, { data: alignmentRows }, { data: proposals }] =
    await Promise.all([
      getCCMembersTransparency(),
      supabase.from('cc_votes').select('cc_hot_id, proposal_tx_hash, proposal_index, vote'),
      supabase
        .from('inter_body_alignment')
        .select('proposal_tx_hash, proposal_index, drep_yes_pct, drep_no_pct'),
      supabase.from('proposals').select('tx_hash, proposal_index, title'),
    ]);

  const safeVotes = votes ?? [];

  // Build alignment map
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

  // Build proposal title map
  const proposalTitleMap = new Map<string, string>();
  for (const p of proposals ?? []) {
    proposalTitleMap.set(`${p.tx_hash}-${p.proposal_index}`, p.title ?? '');
  }

  // Build vote counts
  const memberVoteCounts = new Map<string, number>();
  for (const v of safeVotes) {
    memberVoteCounts.set(v.cc_hot_id, (memberVoteCounts.get(v.cc_hot_id) ?? 0) + 1);
  }

  // Merge member IDs from both sources
  const memberIds = new Set([
    ...members.map((m) => m.ccHotId),
    ...Array.from(memberVoteCounts.keys()),
  ]);
  const memberLookup = new Map(members.map((m) => [m.ccHotId, m]));

  const sortedMembers = Array.from(memberIds)
    .map((id) => {
      const m = memberLookup.get(id);
      return {
        ccHotId: id,
        authorName: m?.authorName ?? null,
        status: m?.status ?? null,
        transparencyIndex: m?.transparencyIndex ?? null,
        transparencyGrade: m?.transparencyGrade ?? null,
        participationScore: m?.participationScore ?? null,
        rationaleQualityScore: m?.rationaleQualityScore ?? null,
        responsivenessScore: m?.responsivenessScore ?? null,
        independenceScore: m?.independenceScore ?? null,
        communityEngagementScore: m?.communityEngagementScore ?? null,
        fidelityScore: m?.fidelityScore ?? null,
        rationaleProvision: m?.rationaleProvisionRate ?? null,
        voteCount: m?.votesCast ?? memberVoteCounts.get(id) ?? 0,
        eligibleProposals: m?.eligibleProposals ?? null,
      };
    })
    .sort(
      (a, b) =>
        (b.transparencyIndex ?? b.fidelityScore ?? -1) -
        (a.transparencyIndex ?? a.fidelityScore ?? -1),
    );

  const totalMembers = sortedMembers.length;
  const totalVotes = safeVotes.length;

  // Unanimous + tension
  const proposalVoteCounts = new Map<string, Map<string, string>>();
  for (const v of safeVotes) {
    const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
    const voteMap = proposalVoteCounts.get(key) ?? new Map<string, string>();
    voteMap.set(v.cc_hot_id, v.vote);
    proposalVoteCounts.set(key, voteMap);
  }

  let unanimousCount = 0;
  interface TensionProposal {
    txHash: string;
    proposalIndex: number;
    title: string | null;
    drepMajority: string;
    ccVote: string;
  }
  const tensionProposals: TensionProposal[] = [];

  for (const [proposalKey, voteMap] of proposalVoteCounts) {
    const allVotes = Array.from(voteMap.values());
    if (allVotes.length < totalMembers || totalMembers === 0) continue;
    const firstVote = allVotes[0];
    const isUnanimous = allVotes.every((v) => v === firstVote);
    if (isUnanimous) {
      unanimousCount++;
      const alignment = alignmentMap.get(proposalKey);
      if (
        alignment &&
        alignment.drepMajority !== 'Abstain' &&
        firstVote !== alignment.drepMajority
      ) {
        const [txHash, idxStr] = proposalKey.split(/-(?=\d+$)/);
        const proposalIndex = parseInt(idxStr ?? '0', 10);
        tensionProposals.push({
          txHash,
          proposalIndex,
          title: proposalTitleMap.get(proposalKey) || null,
          drepMajority: alignment.drepMajority,
          ccVote: firstVote,
        });
      }
    }
  }

  const unanimousRate =
    proposalVoteCounts.size > 0 ? Math.round((unanimousCount / proposalVoteCounts.size) * 100) : 0;

  // Average transparency index
  const scoredMembers = sortedMembers.filter((m) => m.transparencyIndex != null);
  const avgTransparency =
    scoredMembers.length > 0
      ? Math.round(
          scoredMembers.reduce((sum, m) => sum + (m.transparencyIndex ?? 0), 0) /
            scoredMembers.length,
        )
      : null;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageViewTracker event="civica_committee_page_viewed" />

      <Link
        href="/governance"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Governance
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">CC Transparency Index</h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          The Constitutional Committee ensures governance proposals align with the Cardano
          Constitution. The Transparency Index measures participation, rationale quality,
          responsiveness, independence, and community engagement.
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Avg Transparency
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${transparencyColor(avgTransparency)}`}>
                  {avgTransparency ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {scoredMembers.length} of {totalMembers} scored
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Members table — Transparency Index leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Member Transparency Rankings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-center px-3 py-3 font-medium w-10">#</th>
                      <th className="text-left px-4 py-3 font-medium">Member</th>
                      <th className="text-right px-3 py-3 font-medium hidden sm:table-cell">
                        Votes
                      </th>
                      <th className="text-right px-3 py-3 font-medium hidden md:table-cell">
                        Participation
                      </th>
                      <th className="text-right px-3 py-3 font-medium hidden lg:table-cell">
                        Rationale
                      </th>
                      <th className="text-right px-3 py-3 font-medium hidden lg:table-cell">
                        Response
                      </th>
                      <th className="px-4 py-3 font-medium w-48">Transparency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMembers.map((m, idx) => {
                      const score = m.transparencyIndex ?? m.fidelityScore;
                      return (
                        <tr
                          key={m.ccHotId}
                          className="border-b last:border-0 hover:bg-muted/40 transition-colors"
                        >
                          <td className="px-3 py-3 text-center text-muted-foreground tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/committee/${encodeURIComponent(m.ccHotId)}`}
                              className="hover:text-primary transition-colors"
                            >
                              {m.authorName ? (
                                <span className="text-sm font-medium">{m.authorName}</span>
                              ) : (
                                <span className="font-mono text-xs text-foreground/80">
                                  {m.ccHotId.slice(0, 12)}...{m.ccHotId.slice(-6)}
                                </span>
                              )}
                            </Link>
                            {m.status && (
                              <Badge
                                variant="outline"
                                className={`ml-2 text-[10px] ${m.status === 'authorized' ? 'text-emerald-500 border-emerald-500/40' : 'text-muted-foreground'}`}
                              >
                                {m.status}
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right hidden sm:table-cell tabular-nums">
                            {m.voteCount}
                          </td>
                          <td className="px-3 py-3 text-right hidden md:table-cell tabular-nums">
                            {m.participationScore != null
                              ? `${Math.round(m.participationScore)}%`
                              : '—'}
                          </td>
                          <td className="px-3 py-3 text-right hidden lg:table-cell tabular-nums">
                            {m.rationaleQualityScore != null
                              ? Math.round(m.rationaleQualityScore)
                              : '—'}
                          </td>
                          <td className="px-3 py-3 text-right hidden lg:table-cell tabular-nums">
                            {m.responsivenessScore != null
                              ? Math.round(m.responsivenessScore)
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${transparencyBarColor(score)}`}
                                  style={{ width: `${score ?? 0}%` }}
                                />
                              </div>
                              <span
                                className={`text-sm font-mono tabular-nums w-8 text-right ${transparencyColor(score)}`}
                              >
                                {score ?? '—'}
                              </span>
                              {score != null && (
                                <span
                                  className={`text-[10px] font-bold w-4 ${transparencyColor(score)}`}
                                >
                                  {gradeLabel(score)}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Alignment Tension */}
          {tensionProposals.length > 0 && (
            <Card className="border-amber-500/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
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
                          <td className="px-4 py-3">
                            <Link
                              href={`/proposal/${t.txHash}/${t.proposalIndex}`}
                              className="hover:text-primary transition-colors"
                            >
                              {t.title ? (
                                <span className="text-sm line-clamp-1">{t.title}</span>
                              ) : (
                                <span className="font-mono text-xs text-foreground/80">
                                  {t.txHash.slice(0, 12)}...{t.txHash.slice(-6)}
                                  <span className="text-muted-foreground ml-1">
                                    #{t.proposalIndex}
                                  </span>
                                </span>
                              )}
                            </Link>
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

          {/* Methodology */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                Transparency Index Methodology
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground flex items-center gap-1">
                    <Vote className="h-3 w-3" />
                    Participation (35%)
                  </p>
                  <p>
                    What percentage of governance actions did they vote on? Non-participation is the
                    most basic accountability failure.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    Rationale Quality (30%)
                  </p>
                  <p>
                    Do they explain their votes? Do they cite constitutional provisions? Is the
                    reasoning substantive?
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Responsiveness (15%)
                  </p>
                  <p>
                    How quickly do they vote relative to proposal deadlines? Early engagement scores
                    higher.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Independence (10%)
                  </p>
                  <p>
                    Do they exercise independent judgment, or vote identically with the CC on every
                    proposal?
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    Engagement (10%)
                  </p>
                  <p>
                    Do they respond to citizen questions? Do they publish explanations beyond
                    minimal rationales?
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
