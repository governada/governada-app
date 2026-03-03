/**
 * AI-powered proposal classification across 6 alignment dimensions.
 * Falls back to rule-based classification if AI is unavailable.
 */

import { generateJSON } from '@/lib/ai';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ProposalInfo } from '@/types/koios';

export interface ProposalClassification {
  proposalTxHash: string;
  proposalIndex: number;
  dimTreasuryConservative: number;
  dimTreasuryGrowth: number;
  dimDecentralization: number;
  dimSecurity: number;
  dimInnovation: number;
  dimTransparency: number;
  aiSummary: string | null;
}

interface AIClassificationResponse {
  treasury_conservative: number;
  treasury_growth: number;
  decentralization: number;
  security: number;
  innovation: number;
  transparency: number;
  summary: string;
}

const CLASSIFY_SYSTEM = `You are a Cardano governance analyst. Classify proposals by relevance to each dimension.
Return a JSON object with relevance scores 0-1 for each dimension, where 0 = not relevant at all, 1 = highly relevant.
A proposal can be relevant to multiple dimensions simultaneously.`;

function buildClassifyPrompt(proposal: ProposalInfo): string {
  const title = proposal.meta_json?.body?.title || proposal.meta_json?.title || 'Untitled';
  const abstract = proposal.meta_json?.body?.abstract || proposal.meta_json?.abstract || '';
  const motivation = proposal.meta_json?.body?.motivation || proposal.meta_json?.motivation || '';
  const type = proposal.proposal_type;

  let withdrawalInfo = '';
  if (proposal.withdrawal?.length) {
    try {
      const total =
        proposal.withdrawal.reduce((sum, w) => sum + BigInt(w.amount || '0'), BigInt(0)) /
        BigInt(1_000_000);
      withdrawalInfo = `Withdrawal amount: ${total} ADA`;
    } catch {
      withdrawalInfo = 'Withdrawal amount: unknown';
    }
  }

  const paramInfo = proposal.param_proposal
    ? `Parameter changes: ${JSON.stringify(proposal.param_proposal).slice(0, 500)}`
    : '';

  return `Classify this Cardano governance proposal across 6 dimensions.

Type: ${type}
Title: ${title}
Abstract: ${abstract.slice(0, 800)}
Motivation: ${motivation.slice(0, 400)}
${withdrawalInfo}
${paramInfo}

Dimensions:
- treasury_conservative: Relevance to treasury spending restraint (No votes = fiscally conservative)
- treasury_growth: Relevance to strategic treasury investment (Yes votes = growth-oriented)
- decentralization: Relevance to power distribution, governance structure, committee changes
- security: Relevance to protocol safety, parameter stability, hard fork caution
- innovation: Relevance to new features, DeFi growth, ecosystem expansion
- transparency: Relevance to accountability, reporting, governance process quality

Return JSON: { "treasury_conservative": 0-1, "treasury_growth": 0-1, "decentralization": 0-1, "security": 0-1, "innovation": 0-1, "transparency": 0-1, "summary": "one line reason" }`;
}

function ruleBasedClassify(
  proposal: ProposalInfo,
): Omit<ProposalClassification, 'proposalTxHash' | 'proposalIndex'> {
  const scores = {
    dimTreasuryConservative: 0,
    dimTreasuryGrowth: 0,
    dimDecentralization: 0,
    dimSecurity: 0,
    dimInnovation: 0,
    dimTransparency: 0,
    aiSummary: null as string | null,
  };

  switch (proposal.proposal_type) {
    case 'TreasuryWithdrawals':
      scores.dimTreasuryConservative = 0.9;
      scores.dimTreasuryGrowth = 0.9;
      scores.dimTransparency = 0.3;
      break;
    case 'ParameterChange':
      scores.dimSecurity = 0.8;
      scores.dimDecentralization = 0.3;
      break;
    case 'HardForkInitiation':
      scores.dimSecurity = 0.7;
      scores.dimInnovation = 0.6;
      break;
    case 'NoConfidence':
    case 'NewConstitutionalCommittee':
      scores.dimDecentralization = 0.9;
      scores.dimSecurity = 0.4;
      break;
    case 'UpdateConstitution':
    case 'NewConstitution':
      scores.dimDecentralization = 0.6;
      scores.dimSecurity = 0.5;
      scores.dimTransparency = 0.5;
      break;
    case 'InfoAction': {
      const text = [proposal.meta_json?.body?.title, proposal.meta_json?.body?.abstract]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (/treasury|fund|budget|spend|grant/.test(text)) {
        scores.dimTreasuryConservative = 0.5;
        scores.dimTreasuryGrowth = 0.5;
      }
      if (/defi|innovation|growth|ecosystem/.test(text)) scores.dimInnovation = 0.6;
      if (/security|stability|parameter/.test(text)) scores.dimSecurity = 0.5;
      if (/decentral|governance|community|committee/.test(text)) scores.dimDecentralization = 0.5;
      if (/transparent|accountab|reporting/.test(text)) scores.dimTransparency = 0.5;

      scores.dimInnovation = Math.max(scores.dimInnovation, 0.3);
      break;
    }
  }

  scores.aiSummary = `Rule-based: ${proposal.proposal_type}`;
  return scores;
}

/**
 * Classify proposals using AI, with DB caching and rule-based fallback.
 * Only calls AI for proposals not already classified.
 */
export async function classifyProposalsAI(
  proposals: ProposalInfo[],
): Promise<ProposalClassification[]> {
  if (proposals.length === 0) return [];

  const supabase = getSupabaseAdmin();

  // Check which are already classified
  const keys = proposals.map((p) => `${p.proposal_tx_hash}-${p.proposal_index}`);
  const { data: existing } = await supabase
    .from('proposal_classifications')
    .select('*')
    .in('proposal_tx_hash', [...new Set(proposals.map((p) => p.proposal_tx_hash))]);

  const existingMap = new Map<string, ProposalClassification>();
  for (const row of existing || []) {
    const key = `${row.proposal_tx_hash}-${row.proposal_index}`;
    existingMap.set(key, {
      proposalTxHash: row.proposal_tx_hash,
      proposalIndex: row.proposal_index,
      dimTreasuryConservative: row.dim_treasury_conservative,
      dimTreasuryGrowth: row.dim_treasury_growth,
      dimDecentralization: row.dim_decentralization,
      dimSecurity: row.dim_security,
      dimInnovation: row.dim_innovation,
      dimTransparency: row.dim_transparency,
      aiSummary: row.ai_summary,
    });
  }

  const unclassified = proposals.filter(
    (p) => !existingMap.has(`${p.proposal_tx_hash}-${p.proposal_index}`),
  );

  // Classify new proposals in parallel batches to avoid step timeouts
  const newClassifications: ProposalClassification[] = [];
  const AI_CONCURRENCY = 10;

  async function classifyOne(proposal: ProposalInfo): Promise<ProposalClassification> {
    const aiResult = await generateJSON<AIClassificationResponse>(buildClassifyPrompt(proposal), {
      system: CLASSIFY_SYSTEM,
      maxTokens: 256,
    });

    if (aiResult) {
      return {
        proposalTxHash: proposal.proposal_tx_hash,
        proposalIndex: proposal.proposal_index,
        dimTreasuryConservative: clamp01(aiResult.treasury_conservative),
        dimTreasuryGrowth: clamp01(aiResult.treasury_growth),
        dimDecentralization: clamp01(aiResult.decentralization),
        dimSecurity: clamp01(aiResult.security),
        dimInnovation: clamp01(aiResult.innovation),
        dimTransparency: clamp01(aiResult.transparency),
        aiSummary: aiResult.summary?.slice(0, 500) || null,
      };
    }

    const fallback = ruleBasedClassify(proposal);
    return {
      proposalTxHash: proposal.proposal_tx_hash,
      proposalIndex: proposal.proposal_index,
      ...fallback,
    };
  }

  for (let i = 0; i < unclassified.length; i += AI_CONCURRENCY) {
    const batch = unclassified.slice(i, i + AI_CONCURRENCY);
    const results = await Promise.allSettled(batch.map(classifyOne));
    for (const result of results) {
      if (result.status === 'fulfilled') {
        newClassifications.push(result.value);
      }
    }
  }

  // Persist new classifications (archive to classification_history first)
  if (newClassifications.length > 0) {
    const now = new Date().toISOString();
    const rows = newClassifications.map((c) => ({
      proposal_tx_hash: c.proposalTxHash,
      proposal_index: c.proposalIndex,
      dim_treasury_conservative: c.dimTreasuryConservative,
      dim_treasury_growth: c.dimTreasuryGrowth,
      dim_decentralization: c.dimDecentralization,
      dim_security: c.dimSecurity,
      dim_innovation: c.dimInnovation,
      dim_transparency: c.dimTransparency,
      ai_summary: c.aiSummary,
      classified_at: now,
    }));

    const historyRows = rows.map((r) => ({
      proposal_tx_hash: r.proposal_tx_hash,
      proposal_index: r.proposal_index,
      classified_at: now,
      dim_treasury_conservative: r.dim_treasury_conservative,
      dim_treasury_growth: r.dim_treasury_growth,
      dim_decentralization: r.dim_decentralization,
      dim_security: r.dim_security,
      dim_innovation: r.dim_innovation,
      dim_transparency: r.dim_transparency,
      classifier_version: r.ai_summary?.startsWith('Rule-based') ? 'rule-v1' : 'ai-v1',
    }));
    const { error: historyErr } = await supabase.from('classification_history').insert(historyRows);
    if (historyErr) {
      console.warn(
        '[alignment] classification_history insert failed (non-fatal):',
        historyErr.message,
      );
    }

    await supabase
      .from('proposal_classifications')
      .upsert(rows, { onConflict: 'proposal_tx_hash,proposal_index' });

    console.log(
      `[alignment] Classified ${newClassifications.length} new proposals (${newClassifications.filter((c) => !c.aiSummary?.startsWith('Rule-based')).length} via AI)`,
    );
  }

  // Return all classifications
  const results: ProposalClassification[] = [];
  for (const proposal of proposals) {
    const key = `${proposal.proposal_tx_hash}-${proposal.proposal_index}`;
    const cached = existingMap.get(key);
    const fresh = newClassifications.find(
      (c) =>
        c.proposalTxHash === proposal.proposal_tx_hash &&
        c.proposalIndex === proposal.proposal_index,
    );
    results.push(cached || fresh!);
  }

  return results;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v || 0));
}
