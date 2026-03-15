import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async () => {
  const supabase = createClient();

  const [predictionsResult, accuracyResult, proposalsResult] = await Promise.all([
    supabase
      .from('cc_predictive_signals')
      .select('*')
      .is('actual_outcome', null) // only pending predictions
      .order('predicted_at', { ascending: false }),
    supabase
      .from('cc_predictive_signals')
      .select('prediction_accurate')
      .not('prediction_accurate', 'is', null), // only resolved predictions
    supabase.from('proposals').select('tx_hash, proposal_index, title, proposal_type'),
  ]);

  // Build proposal title lookup
  const proposalTitleMap = new Map<string, { title: string | null; type: string }>();
  for (const p of proposalsResult.data ?? []) {
    proposalTitleMap.set(`${p.tx_hash}:${p.proposal_index}`, {
      title: p.title,
      type: p.proposal_type,
    });
  }

  const predictions = (predictionsResult.data ?? []).map((p) => {
    const proposalKey = `${p.proposal_tx_hash}:${p.proposal_index}`;
    const proposal = proposalTitleMap.get(proposalKey);
    return {
      proposalTxHash: p.proposal_tx_hash as string,
      proposalIndex: p.proposal_index as number,
      proposalTitle: proposal?.title ?? null,
      proposalType: proposal?.type ?? null,
      predictedOutcome: p.predicted_outcome as string,
      predictedSplit: p.predicted_split as Record<string, string[]> | null,
      confidence: p.confidence as number,
      reasoning: (p.reasoning as string) ?? null,
      keyArticle: (p.key_article as string) ?? null,
      tensionFlag: p.tension_flag as boolean,
      predictedAt: p.predicted_at as string,
    };
  });

  const resolved = accuracyResult.data ?? [];
  const correct = resolved.filter((r) => r.prediction_accurate === true).length;

  return NextResponse.json({
    predictions,
    accuracy: {
      totalPredictions: resolved.length,
      correct,
      accuracyPct: resolved.length > 0 ? Math.round((correct / resolved.length) * 100) : null,
    },
  });
});
