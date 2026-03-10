import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { getCCTransparencyHistory, getCCMembersTransparency } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageViewTracker } from '@/components/PageViewTracker';
import { CCTransparencyTrend } from '@/components/cc/CCTransparencyTrend';
import {
  Scale,
  BookOpen,
  Sparkles,
  Clock,
  ShieldCheck,
  Users,
  Vote,
  MessageCircle,
} from 'lucide-react';
import { Breadcrumb } from '@/components/shared/Breadcrumb';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ ccHotId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ccHotId } = await params;
  const supabase = createClient();
  const { data: member } = await supabase
    .from('cc_members')
    .select('author_name')
    .eq('cc_hot_id', ccHotId)
    .maybeSingle();

  const name = member?.author_name ?? `CC Member ${ccHotId.slice(0, 12)}...`;
  return {
    title: `${name} — CC Transparency Index — Governada`,
    description: `Constitutional Committee member transparency score, voting record, and accountability metrics.`,
  };
}

function gradeStyle(score: number): { label: string; color: string; bg: string } {
  if (score >= 85)
    return { label: 'A', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30' };
  if (score >= 70)
    return { label: 'B', color: 'text-cyan-500', bg: 'bg-cyan-500/10 border-cyan-500/30' };
  if (score >= 55)
    return { label: 'C', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/30' };
  if (score >= 40)
    return { label: 'D', color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/30' };
  return { label: 'F', color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/30' };
}

export default async function CCMemberProfilePage({ params }: PageProps) {
  const { ccHotId } = await params;
  const decodedId = decodeURIComponent(ccHotId);
  const supabase = createClient();

  // Fetch member data, votes, rationales, alignment, history, and peer data in parallel
  const [
    { data: member },
    { data: votes },
    { data: rationales },
    { data: alignmentRows },
    transparencyHistory,
    allMembers,
  ] = await Promise.all([
    supabase.from('cc_members').select('*').eq('cc_hot_id', decodedId).maybeSingle(),
    supabase
      .from('cc_votes')
      .select('proposal_tx_hash, proposal_index, vote, block_time, epoch, meta_url')
      .eq('cc_hot_id', decodedId)
      .order('block_time', { ascending: false }),
    supabase
      .from('cc_rationales')
      .select(
        'proposal_tx_hash, proposal_index, summary, cited_articles, author_name, internal_vote',
      )
      .eq('cc_hot_id', decodedId),
    supabase
      .from('inter_body_alignment')
      .select(
        'proposal_tx_hash, proposal_index, drep_yes_pct, drep_no_pct, spo_yes_pct, spo_no_pct',
      ),
    getCCTransparencyHistory(decodedId),
    getCCMembersTransparency(),
  ]);

  const safeVotes = votes ?? [];
  if (safeVotes.length === 0) notFound();

  // Get proposal details for votes
  const proposalKeys = safeVotes.map((v) => v.proposal_tx_hash);
  const { data: proposals } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, title, proposal_type, block_time')
    .in('tx_hash', [...new Set(proposalKeys)]);

  const proposalMap = new Map<string, { title: string | null; type: string; blockTime: number }>();
  for (const p of proposals ?? []) {
    proposalMap.set(`${p.tx_hash}:${p.proposal_index}`, {
      title: p.title,
      type: p.proposal_type,
      blockTime: p.block_time,
    });
  }

  // Build rationale lookup
  const rationaleMap = new Map<
    string,
    { summary: string | null; citedArticles: string[]; internalVote: unknown }
  >();
  for (const r of rationales ?? []) {
    rationaleMap.set(`${r.proposal_tx_hash}:${r.proposal_index}`, {
      summary: r.summary,
      citedArticles: (r.cited_articles as string[]) ?? [],
      internalVote: r.internal_vote,
    });
  }

  // Build alignment lookup
  const alignmentLookup = new Map<string, { drepMajority: string; spoMajority: string }>();
  for (const row of alignmentRows ?? []) {
    const key = `${row.proposal_tx_hash}:${row.proposal_index}`;
    alignmentLookup.set(key, {
      drepMajority:
        row.drep_yes_pct > row.drep_no_pct
          ? 'Yes'
          : row.drep_no_pct > row.drep_yes_pct
            ? 'No'
            : 'Abstain',
      spoMajority:
        (row.spo_yes_pct ?? 0) > (row.spo_no_pct ?? 0)
          ? 'Yes'
          : (row.spo_no_pct ?? 0) > (row.spo_yes_pct ?? 0)
            ? 'No'
            : 'Abstain',
    });
  }

  // Stats
  const totalVotes = safeVotes.length;
  const yesCount = safeVotes.filter((v) => v.vote === 'Yes').length;
  const noCount = safeVotes.filter((v) => v.vote === 'No').length;
  const abstainCount = safeVotes.filter((v) => v.vote === 'Abstain').length;
  const withRationale = safeVotes.filter((v) => v.meta_url).length;
  const approvalRate = totalVotes > 0 ? Math.round((yesCount / totalVotes) * 100) : 0;

  // DRep alignment
  let drepAgree = 0;
  let drepCompare = 0;
  let spoAgree = 0;
  let spoCompare = 0;
  for (const v of safeVotes) {
    const a = alignmentLookup.get(`${v.proposal_tx_hash}:${v.proposal_index}`);
    if (a) {
      if (a.drepMajority !== 'Abstain') {
        drepCompare++;
        if (v.vote === a.drepMajority) drepAgree++;
      }
      if (a.spoMajority !== 'Abstain') {
        spoCompare++;
        if (v.vote === a.spoMajority) spoAgree++;
      }
    }
  }
  const drepAlignmentPct = drepCompare > 0 ? Math.round((drepAgree / drepCompare) * 100) : null;
  const spoAlignmentPct = spoCompare > 0 ? Math.round((spoAgree / spoCompare) * 100) : null;

  // Proposal type breakdown
  const typeBreakdown = new Map<string, { yes: number; no: number; abstain: number }>();
  for (const v of safeVotes) {
    const proposal = proposalMap.get(`${v.proposal_tx_hash}:${v.proposal_index}`);
    const type = proposal?.type ?? 'Unknown';
    const counts = typeBreakdown.get(type) ?? { yes: 0, no: 0, abstain: 0 };
    if (v.vote === 'Yes') counts.yes++;
    else if (v.vote === 'No') counts.no++;
    else counts.abstain++;
    typeBreakdown.set(type, counts);
  }

  const authorName = member?.author_name ?? rationales?.[0]?.author_name ?? null;

  // Transparency Index (headline metric)
  const transparencyIndex = member?.transparency_index ?? null;
  const transparencyGrade = transparencyIndex != null ? gradeStyle(transparencyIndex) : null;

  // Peer rank
  const scoredMembers = allMembers.filter((m) => m.transparencyIndex != null);
  const rank = scoredMembers.findIndex((m) => m.ccHotId === decodedId) + 1;
  const totalScored = scoredMembers.length;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageViewTracker event="cc_member_profile_viewed" properties={{ cc_hot_id: decodedId }} />

      <Breadcrumb
        items={[
          { label: 'Governance', href: '/' },
          { label: 'Committee', href: '/governance/committee' },
          { label: authorName ?? `CC ${decodedId.slice(0, 12)}\u2026` },
        ]}
      />

      {/* Hero */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 space-y-2">
            {authorName ? (
              <>
                <h1 className="text-2xl sm:text-3xl font-bold">{authorName}</h1>
                <p className="font-mono text-xs text-muted-foreground break-all">{decodedId}</p>
              </>
            ) : (
              <h1 className="text-xl sm:text-2xl font-bold font-mono break-all">{decodedId}</h1>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                Constitutional Committee
              </Badge>
              {member?.status && (
                <Badge
                  variant="outline"
                  className={
                    member.status === 'authorized'
                      ? 'text-emerald-500 border-emerald-500/40'
                      : 'text-muted-foreground'
                  }
                >
                  {member.status}
                </Badge>
              )}
              {member?.expiration_epoch && (
                <Badge variant="secondary" className="text-xs">
                  Expires epoch {member.expiration_epoch}
                </Badge>
              )}
              {rank > 0 && (
                <Badge variant="secondary" className="text-xs">
                  Rank {rank}/{totalScored}
                </Badge>
              )}
            </div>
          </div>

          {/* Transparency Index hero card */}
          {transparencyIndex != null && transparencyGrade && (
            <Card className={`shrink-0 w-48 border ${transparencyGrade.bg}`}>
              <CardContent className="py-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Transparency Index</p>
                <p className={`text-4xl font-bold ${transparencyGrade.color}`}>
                  {transparencyIndex}
                </p>
                <p className={`text-lg font-bold ${transparencyGrade.color}`}>
                  Grade {transparencyGrade.label}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Participation</p>
            <p className="text-xl font-bold">
              {member?.votes_cast ?? totalVotes}/{member?.eligible_proposals ?? '?'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {member?.eligible_proposals
                ? `${Math.round(((member.votes_cast ?? totalVotes) / member.eligible_proposals) * 100)}% vote rate`
                : 'proposals voted on'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Approval Rate</p>
            <p className="text-xl font-bold">{approvalRate}%</p>
            <p className="text-[10px] text-muted-foreground">
              {yesCount}Y / {noCount}N / {abstainCount}A
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Rationales Provided</p>
            <p className="text-xl font-bold">
              {withRationale}/{totalVotes}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {totalVotes > 0 ? Math.round((withRationale / totalVotes) * 100) : 0}% provision rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">DRep Alignment</p>
            <p className="text-xl font-bold">{drepAlignmentPct ?? '—'}%</p>
            <p className="text-[10px] text-muted-foreground">
              {drepCompare > 0 ? `${drepAgree}/${drepCompare} matched` : 'No data'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">SPO Alignment</p>
            <p className="text-xl font-bold">{spoAlignmentPct ?? '—'}%</p>
            <p className="text-[10px] text-muted-foreground">
              {spoCompare > 0 ? `${spoAgree}/${spoCompare} matched` : 'No data'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transparency Index 5-pillar breakdown */}
      {member && transparencyIndex != null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Transparency Index Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <PillarBar
                icon={<Vote className="h-3.5 w-3.5" />}
                label="Participation"
                weight="35%"
                score={member.participation_score}
              />
              <PillarBar
                icon={<BookOpen className="h-3.5 w-3.5" />}
                label="Rationale Quality"
                weight="30%"
                score={member.rationale_quality_score}
              />
              <PillarBar
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Responsiveness"
                weight="15%"
                score={member.responsiveness_score}
              />
              <PillarBar
                icon={<Sparkles className="h-3.5 w-3.5" />}
                label="Independence"
                weight="10%"
                score={member.independence_score}
              />
              <PillarBar
                icon={<MessageCircle className="h-3.5 w-3.5" />}
                label="Engagement"
                weight="10%"
                score={member.community_engagement_score}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transparency Trend */}
      <CCTransparencyTrend history={transparencyHistory} />

      {/* Inter-body alignment */}
      {(drepAlignmentPct != null || spoAlignmentPct != null) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Inter-Body Alignment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {drepAlignmentPct != null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">DRep Consensus</span>
                    <span className="text-sm font-mono tabular-nums">{drepAlignmentPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-cyan-500/80"
                      style={{ width: `${drepAlignmentPct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Aligned with DRep majority on {drepAgree} of {drepCompare} proposals
                  </p>
                </div>
              )}
              {spoAlignmentPct != null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">SPO Consensus</span>
                    <span className="text-sm font-mono tabular-nums">{spoAlignmentPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-500/80"
                      style={{ width: `${spoAlignmentPct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Aligned with SPO majority on {spoAgree} of {spoCompare} proposals
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Proposal type breakdown */}
      {typeBreakdown.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Votes by Proposal Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from(typeBreakdown.entries())
                .sort((a, b) => {
                  const totalA = a[1].yes + a[1].no + a[1].abstain;
                  const totalB = b[1].yes + b[1].no + b[1].abstain;
                  return totalB - totalA;
                })
                .map(([type, counts]) => {
                  const total = counts.yes + counts.no + counts.abstain;
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-40 shrink-0 truncate">
                        {type}
                      </span>
                      <div className="flex-1 flex h-4 rounded-full overflow-hidden bg-muted">
                        {counts.yes > 0 && (
                          <div
                            className="bg-emerald-500/70 h-full"
                            style={{ width: `${(counts.yes / total) * 100}%` }}
                          />
                        )}
                        {counts.no > 0 && (
                          <div
                            className="bg-rose-500/70 h-full"
                            style={{ width: `${(counts.no / total) * 100}%` }}
                          />
                        )}
                        {counts.abstain > 0 && (
                          <div
                            className="bg-amber-500/70 h-full"
                            style={{ width: `${(counts.abstain / total) * 100}%` }}
                          />
                        )}
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground w-12 text-right">
                        {total}
                      </span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Voting record */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voting Record</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left px-4 py-3 font-medium">Proposal</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Type</th>
                  <th className="text-center px-4 py-3 font-medium">Vote</th>
                  <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">
                    DRep Majority
                  </th>
                  <th className="text-center px-4 py-3 font-medium hidden lg:table-cell">
                    Rationale
                  </th>
                  <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Epoch</th>
                </tr>
              </thead>
              <tbody>
                {safeVotes.map((v) => {
                  const pKey = `${v.proposal_tx_hash}:${v.proposal_index}`;
                  const proposal = proposalMap.get(pKey);
                  const rationale = rationaleMap.get(pKey);
                  const alignment = alignmentLookup.get(pKey);
                  const drepMajority = alignment?.drepMajority;
                  const isAligned = drepMajority ? v.vote === drepMajority : null;

                  return (
                    <tr
                      key={`${v.proposal_tx_hash}-${v.proposal_index}`}
                      className="border-b last:border-0 hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/proposal/${v.proposal_tx_hash}/${v.proposal_index}`}
                          className="hover:text-primary transition-colors"
                        >
                          {proposal?.title ? (
                            <span className="text-sm line-clamp-1">{proposal.title}</span>
                          ) : (
                            <span className="font-mono text-xs">
                              {v.proposal_tx_hash.slice(0, 12)}...
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge variant="secondary" className="text-[10px]">
                          {proposal?.type ?? '—'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            v.vote === 'Yes'
                              ? 'text-emerald-500 border-emerald-500/40'
                              : v.vote === 'No'
                                ? 'text-rose-500 border-rose-500/40'
                                : 'text-amber-500 border-amber-500/40'
                          }
                        >
                          {v.vote}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        {drepMajority && drepMajority !== 'Abstain' ? (
                          <span
                            className={`text-xs ${isAligned ? 'text-emerald-500' : 'text-rose-500'}`}
                          >
                            {drepMajority} {isAligned ? '(aligned)' : '(diverged)'}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        {rationale ? (
                          <span
                            className="text-xs text-emerald-500"
                            title={rationale.summary ?? undefined}
                          >
                            {rationale.citedArticles.length > 0
                              ? `${rationale.citedArticles.length} articles`
                              : 'Provided'}
                          </span>
                        ) : v.meta_url ? (
                          <span className="text-xs text-amber-500">Pending parse</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell tabular-nums text-muted-foreground">
                        {v.epoch}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PillarBar({
  icon,
  label,
  weight,
  score,
}: {
  icon: React.ReactNode;
  label: string;
  weight: string;
  score: number | null;
}) {
  const displayScore = score != null ? Math.round(score) : null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium flex items-center gap-1">
          {icon}
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground">{weight}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-cyan-500/80 transition-all"
          style={{ width: `${displayScore ?? 0}%` }}
        />
      </div>
      <p className="text-xs tabular-nums text-right text-muted-foreground">
        {displayScore != null ? `${displayScore}/100` : 'Pending'}
      </p>
    </div>
  );
}
