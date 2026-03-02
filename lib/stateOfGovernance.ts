/**
 * State of Governance — assembles epoch-level report data and generates
 * an AI-narrated editorial narrative. The canonical governance artifact.
 */

import { getSupabaseAdmin } from './supabase';
import { computeGHI, type GHIResult } from './ghi';
import { computeInsights, type GovernanceInsight } from './proposalIntelligence';
import { generateText } from './ai';

export interface ReportProposal {
  txHash: string;
  index: number;
  title: string | null;
  type: string;
  outcome: 'ratified' | 'enacted' | 'dropped' | 'expired' | 'open';
  withdrawalAda: number | null;
}

export interface ReportMover {
  drepId: string;
  name: string;
  score: number;
  delta: number;
}

export interface ReportData {
  epoch: number;
  dateRange: { start: string; end: string };
  ghi: GHIResult;
  ghiPrevScore: number | null;
  insights: GovernanceInsight[];
  proposals: ReportProposal[];
  movers: { gainers: ReportMover[]; losers: ReportMover[] };
  stats: {
    totalVotes: number;
    totalDReps: number;
    activeDReps: number;
    totalAdaGoverned: string;
    avgParticipation: number;
    avgRationale: number;
  };
  communityGap: Array<{ proposalTitle: string; communityVote: string; drepVote: string }>;
  treasuryBalance: string;
}

export async function assembleReportData(targetEpoch?: number): Promise<ReportData> {
  const supabase = getSupabaseAdmin();

  const { data: govStats } = await supabase
    .from('governance_stats')
    .select('current_epoch, treasury_balance_lovelace')
    .eq('id', 1)
    .single();

  const epoch = targetEpoch ?? (govStats?.current_epoch ?? 0);

  const [ghi, insights] = await Promise.all([
    computeGHI(),
    computeInsights(),
  ]);

  const { data: ghiPrev } = await supabase
    .from('ghi_snapshots')
    .select('score')
    .lt('epoch_no', epoch)
    .order('epoch_no', { ascending: false })
    .limit(1)
    .single();

  const { data: proposals } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, title, proposal_type, withdrawal_amount, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch')
    .or(`proposed_epoch.eq.${epoch},ratified_epoch.eq.${epoch},enacted_epoch.eq.${epoch},dropped_epoch.eq.${epoch},expired_epoch.eq.${epoch}`);

  const reportProposals: ReportProposal[] = (proposals ?? []).map(p => ({
    txHash: p.tx_hash,
    index: p.proposal_index,
    title: p.title,
    type: p.proposal_type,
    outcome: p.enacted_epoch ? 'enacted' : p.ratified_epoch ? 'ratified' : p.dropped_epoch ? 'dropped' : p.expired_epoch ? 'expired' : 'open',
    withdrawalAda: p.withdrawal_amount ? Number(p.withdrawal_amount) / 1_000_000 : null,
  }));

  const { data: currentScores } = await supabase
    .from('dreps')
    .select('id, score, info')
    .order('score', { ascending: false })
    .limit(500);

  const { data: prevScores } = await supabase
    .from('drep_score_history')
    .select('drep_id, score')
    .order('snapshot_date', { ascending: false });

  const prevScoreMap = new Map<string, number>();
  if (prevScores) {
    for (const s of prevScores) {
      if (!prevScoreMap.has(s.drep_id)) prevScoreMap.set(s.drep_id, s.score);
    }
  }

  const movers = (currentScores ?? [])
    .filter((d: any) => d.info?.isActive && d.score != null)
    .map((d: any) => ({
      drepId: d.id,
      name: d.info?.givenName || d.id.slice(0, 12) + '...',
      score: d.score ?? 0,
      delta: (d.score ?? 0) - (prevScoreMap.get(d.id) ?? d.score ?? 0),
    }))
    .filter((m: ReportMover) => m.delta !== 0);

  const gainers = [...movers].sort((a, b) => b.delta - a.delta).slice(0, 3);
  const losers = [...movers].sort((a, b) => a.delta - b.delta).slice(0, 3);

  const { count: voteCount } = await supabase
    .from('drep_votes')
    .select('vote_tx_hash', { count: 'exact', head: true })
    .eq('epoch_no', epoch);

  const activeDreps = (currentScores ?? []).filter((d: any) => d.info?.isActive);
  const totalAda = activeDreps.reduce((s: number, d: any) =>
    s + parseInt(d.info?.votingPowerLovelace || '0', 10), 0) / 1_000_000;

  const formattedAda = totalAda >= 1e9 ? `${(totalAda / 1e9).toFixed(1)}B` : `${(totalAda / 1e6).toFixed(1)}M`;

  const avgParticipation = activeDreps.length > 0
    ? activeDreps.reduce((s: number, d: any) => s + (d.info?.effective_participation ?? 0), 0) / activeDreps.length
    : 0;

  const treasuryBalance = govStats?.treasury_balance_lovelace
    ? `${(Number(govStats.treasury_balance_lovelace) / 1_000_000_000_000).toFixed(2)}B`
    : 'N/A';

  const epochDays = 5;
  const now = new Date();
  const start = new Date(now.getTime() - epochDays * 86400000);

  return {
    epoch,
    dateRange: {
      start: start.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    },
    ghi,
    ghiPrevScore: ghiPrev?.score != null ? Number(ghiPrev.score) : null,
    insights: insights.slice(0, 5),
    proposals: reportProposals,
    movers: { gainers, losers },
    stats: {
      totalVotes: voteCount ?? 0,
      totalDReps: (currentScores ?? []).length,
      activeDReps: activeDreps.length,
      totalAdaGoverned: formattedAda,
      avgParticipation: Math.round(avgParticipation),
      avgRationale: Math.round(ghi.components.find(c => c.name === 'Rationale')?.value ?? 0),
    },
    communityGap: [],
    treasuryBalance,
  };
}

export async function generateReportNarrative(data: ReportData): Promise<string | null> {
  const ghiDelta = data.ghiPrevScore != null ? data.ghi.score - data.ghiPrevScore : null;
  const topInsights = data.insights.slice(0, 3).map(i => `- ${i.headline}: ${i.stat}`).join('\n');
  const outcomesSummary = data.proposals
    .filter(p => p.outcome !== 'open')
    .map(p => `- "${p.title || 'Untitled'}" (${p.type}): ${p.outcome}${p.withdrawalAda ? ` — ${p.withdrawalAda.toLocaleString()} ADA` : ''}`)
    .join('\n');
  const gainersSummary = data.movers.gainers.map(m => `${m.name} (+${m.delta})`).join(', ');
  const losersSummary = data.movers.losers.map(m => `${m.name} (${m.delta})`).join(', ');

  const prompt = `You are the editorial voice of DRepScore, writing the "State of Governance" report for Cardano Epoch ${data.epoch}. Write an engaging 600-800 word editorial narrative.

Tone: authoritative yet accessible. Like a Bloomberg governance correspondent who genuinely cares about decentralization. Use specific numbers from the data. Do NOT fabricate any statistics.

DATA:
- GHI Score: ${data.ghi.score}/100 (${data.ghi.band})${ghiDelta != null ? `, ${ghiDelta > 0 ? 'up' : 'down'} ${Math.abs(ghiDelta)} from last epoch` : ''}
- Active DReps: ${data.stats.activeDReps} of ${data.stats.totalDReps}
- Votes this epoch: ${data.stats.totalVotes}
- ADA governed: ${data.stats.totalAdaGoverned}
- Avg participation: ${data.stats.avgParticipation}%
- Treasury: ${data.treasuryBalance} ADA

KEY INSIGHTS:
${topInsights || 'No notable insights this epoch.'}

PROPOSAL OUTCOMES:
${outcomesSummary || 'No proposals resolved this epoch.'}

DREP MOVERS:
Gainers: ${gainersSummary || 'None'}
Losers: ${losersSummary || 'None'}

Structure: Start with the headline story (most newsworthy item). Cover GHI trend, notable proposals, DRep movements, and one forward-looking observation. End with a call to governance participation.

Output only the narrative. No title, no headings, no markdown formatting.`;

  return generateText(prompt, { maxTokens: 1200, model: 'FAST' });
}

export async function generateAndStoreReport(epoch?: number): Promise<{ epoch: number; stored: boolean }> {
  const data = await assembleReportData(epoch);
  const narrative = await generateReportNarrative(data);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('state_of_governance_reports')
    .upsert({
      epoch_no: data.epoch,
      report_data: data as unknown as Record<string, unknown>,
      narrative_html: narrative,
      published: true,
    }, { onConflict: 'epoch_no' });

  if (error) {
    console.error('[StateOfGovernance] Store error:', error);
    return { epoch: data.epoch, stored: false };
  }

  return { epoch: data.epoch, stored: true };
}
